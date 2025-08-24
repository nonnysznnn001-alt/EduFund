;; campaign.clar
;; Campaign Smart Contract for EduFund
;; Manages crowdfunding campaigns for educational projects in developing regions.
;; Features include campaign creation, donations, milestone tracking, fund releases, and refunds.

;; Constants for error codes
(define-constant ERR-UNAUTHORIZED u100)
(define-constant ERR-INVALID-INPUT u101)
(define-constant ERR-NOT-ACTIVE u102)
(define-constant ERR-ALREADY-ENDED u103)
(define-constant ERR-MILESTONE-NOT-FOUND u104)
(define-constant ERR-MILESTONE-NOT-APPROVED u105)
(define-constant ERR-INSUFFICIENT-FUNDS u106)
(define-constant ERR-CAMPAIGN-EXPIRED u107)
(define-constant ERR-INVALID-REGION u108)
(define-constant ERR-NOT-CREATOR u109)
(define-constant ERR-MAX-MILESTONES u110)
(define-constant ERR-ALREADY-INITIALIZED u111)
(define-constant ERR-INVALID-DURATION u112)

;; Constants for configuration
(define-constant MAX-MILESTONES u10)
(define-constant MIN-FUNDING-GOAL u1000000) ;; 1 STX in microstacks
(define-constant MAX-DESCRIPTION-LEN u500)
(define-constant MAX-TITLE-LEN u100)
(define-constant MAX-REGION-LEN u50)
(define-constant MAX-EVIDENCE-LEN u200)

;; Data variables
(define-data-var campaign-counter uint u0)
(define-data-var admin principal tx-sender)

;; Data maps
(define-map campaigns
  uint
  {
    creator: principal,
    title: (string-utf8 100),
    description: (string-utf8 500),
    region: (string-utf8 50),
    funding-goal: uint,
    total-raised: uint,
    deadline: uint,
    active: bool,
    ended: bool,
    created-at: uint
  }
)

(define-map milestones
  { campaign-id: uint, milestone-id: uint }
  {
    description: (string-utf8 200),
    amount: uint, ;; Portion of funds to release
    approved: bool,
    evidence-hash: (optional (buff 32)),
    submitted-at: (optional uint),
    approved-at: (optional uint)
  }
)

(define-map donations
  { campaign-id: uint, donor: principal }
  {
    amount: uint,
    timestamp: uint
  }
)

;; Allowed regions (simplified for demo; in practice, could be a map or external oracle)
(define-constant allowed-regions
  (list
    u"Africa"
    u"South Asia"
    u"Southeast Asia"
    u"Latin America"
  )
)

;; Private functions
(define-private (is-valid-region (region (string-utf8 50)))
  (is-some (index-of? allowed-regions region))
)

(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin))
)

(define-private (is-campaign-active (campaign-id uint))
  (let ((campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-NOT-ACTIVE))))
    (and
      (get active campaign)
      (not (get ended campaign))
      (<= (block-height) (get deadline campaign))
    )
  )
)

;; Public functions
(define-public (create-campaign
  (title (string-utf8 100))
  (description (string-utf8 500))
  (region (string-utf8 50))
  (funding-goal uint)
  (duration uint))
  (let
    (
      (campaign-id (+ (var-get campaign-counter) u1))
      (creator tx-sender)
      (current-block block-height)
    )
    (asserts! (<= (len title) MAX-TITLE-LEN) (err ERR-INVALID-INPUT))
    (asserts! (<= (len description) MAX-DESCRIPTION-LEN) (err ERR-INVALID-INPUT))
    (asserts! (<= (len region) MAX-REGION-LEN) (err ERR-INVALID-INPUT))
    (asserts! (is-valid-region region) (err ERR-INVALID-REGION))
    (asserts! (>= funding-goal MIN-FUNDING-GOAL) (err ERR-INVALID-INPUT))
    (asserts! (and (> duration u0) (<= duration u52560)) (err ERR-INVALID-DURATION)) ;; Max 1 year (~52560 blocks)
    (map-set campaigns
      campaign-id
      {
        creator: creator,
        title: title,
        description: description,
        region: region,
        funding-goal: funding-goal,
        total-raised: u0,
        deadline: (+ current-block duration),
        active: true,
        ended: false,
        created-at: current-block
      }
    )
    (var-set campaign-counter campaign-id)
    (ok campaign-id)
  )
)

(define-public (donate (campaign-id uint) (amount uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-NOT-ACTIVE)))
      (donor tx-sender)
    )
    (asserts! (is-campaign-active campaign-id) (err ERR-CAMPAIGN-EXPIRED))
    (asserts! (> amount u0) (err ERR-INVALID-INPUT))
    (try! (stx-transfer? amount donor (as-contract tx-sender)))
    (map-set donations
      { campaign-id: campaign-id, donor: donor }
      {
        amount: amount,
        timestamp: block-height
      }
    )
    (map-set campaigns
      campaign-id
      (merge campaign { total-raised: (+ (get total-raised campaign) amount) })
    )
    (ok true)
  )
)

(define-public (add-milestone
  (campaign-id uint)
  (milestone-id uint)
  (description (string-utf8 200))
  (amount uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-NOT-ACTIVE)))
    )
    (asserts! (is-eq (get creator campaign) tx-sender) (err ERR-NOT-CREATOR))
    (asserts! (is-campaign-active campaign-id) (err ERR-CAMPAIGN-EXPIRED))
    (asserts! (<= milestone-id MAX-MILESTONES) (err ERR-MAX-MILESTONES))
    (asserts! (<= (len description) MAX-EVIDENCE-LEN) (err ERR-INVALID-INPUT))
    (asserts! (> amount u0) (err ERR-INVALID-INPUT))
    (asserts! (is-none (map-get? milestones { campaign-id: campaign-id, milestone-id: milestone-id }))
      (err ERR-ALREADY-INITIALIZED))
    (map-set milestones
      { campaign-id: campaign-id, milestone-id: milestone-id }
      {
        description: description,
        amount: amount,
        approved: false,
        evidence-hash: none,
        submitted-at: none,
        approved-at: none
      }
    )
    (ok true)
  )
)

(define-public (submit-milestone-evidence
  (campaign-id uint)
  (milestone-id uint)
  (evidence-hash (buff 32)))
  (let
    (
      (campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-NOT-ACTIVE)))
      (milestone (unwrap! (map-get? milestones { campaign-id: campaign-id, milestone-id: milestone-id })
        (err ERR-MILESTONE-NOT-FOUND)))
    )
    (asserts! (is-eq (get creator campaign) tx-sender) (err ERR-NOT-CREATOR))
    (asserts! (is-campaign-active campaign-id) (err ERR-CAMPAIGN-EXPIRED))
    (asserts! (not (get approved milestone)) (err ERR-MILESTONE-NOT-APPROVED))
    (map-set milestones
      { campaign-id: campaign-id, milestone-id: milestone-id }
      (merge milestone
        {
          evidence-hash: (some evidence-hash),
          submitted-at: (some block-height)
        }
      )
    )
    (ok true)
  )
)

(define-public (approve-milestone (campaign-id uint) (milestone-id uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-NOT-ACTIVE)))
      (milestone (unwrap! (map-get? milestones { campaign-id: campaign-id, milestone-id: milestone-id })
        (err ERR-MILESTONE-NOT-FOUND)))
    )
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (asserts! (is-campaign-active campaign-id) (err ERR-CAMPAIGN-EXPIRED))
    (asserts! (is-some (get evidence-hash milestone)) (err ERR-INVALID-INPUT))
    (asserts! (>= (get total-raised campaign) (get amount milestone)) (err ERR-INSUFFICIENT-FUNDS))
    (try! (as-contract (stx-transfer? (get amount milestone) tx-sender (get creator campaign))))
    (map-set milestones
      { campaign-id: campaign-id, milestone-id: milestone-id }
      (merge milestone
        {
          approved: true,
          approved-at: (some block-height)
        }
      )
    )
    (ok true)
  )
)

(define-public (end-campaign (campaign-id uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-NOT-ACTIVE)))
    )
    (asserts! (or (is-admin tx-sender) (is-eq (get creator campaign) tx-sender)) (err ERR-UNAUTHORIZED))
    (asserts! (is-campaign-active campaign-id) (err ERR-CAMPAIGN-EXPIRED))
    (map-set campaigns
      campaign-id
      (merge campaign { active: false, ended: true })
    )
    (ok true)
  )
)

(define-public (refund-donors (campaign-id uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-NOT-ACTIVE)))
    )
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (asserts! (not (is-campaign-active campaign-id)) (err ERR-ALREADY-ENDED))
    ;; In practice, refunds would iterate over donations map (simplified here for clarity)
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-campaign (campaign-id uint))
  (map-get? campaigns campaign-id)
)

(define-read-only (get-milestone (campaign-id uint) (milestone-id uint))
  (map-get? milestones { campaign-id: campaign-id, milestone-id: milestone-id })
)

(define-read-only (get-donation (campaign-id uint) (donor principal))
  (map-get? donations { campaign-id: campaign-id, donor: donor })
)

(define-read-only (get-campaign-counter)
  (var-get campaign-counter)
)