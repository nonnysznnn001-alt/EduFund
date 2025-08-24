import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Campaign {
  creator: string;
  title: string;
  description: string;
  region: string;
  fundingGoal: number;
  totalRaised: number;
  deadline: number;
  active: boolean;
  ended: boolean;
  createdAt: number;
}

interface Milestone {
  description: string;
  amount: number;
  approved: boolean;
  evidenceHash: string | null;
  submittedAt: number | null;
  approvedAt: number | null;
}

interface Donation {
  amount: number;
  timestamp: number;
}

interface ContractState {
  campaigns: Map<number, Campaign>;
  milestones: Map<string, Milestone>;
  donations: Map<string, Donation>;
  campaignCounter: number;
  admin: string;
  blockHeight: number;
  balances: Map<string, number>;
}

// Mock contract implementation
class CampaignMock {
  private state: ContractState = {
    campaigns: new Map(),
    milestones: new Map(),
    donations: new Map(),
    campaignCounter: 0,
    admin: "deployer",
    blockHeight: 1000,
    balances: new Map([["contract", 0]]),
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_INVALID_INPUT = 101;
  private ERR_NOT_ACTIVE = 102;
  private ERR_ALREADY_ENDED = 103;
  private ERR_MILESTONE_NOT_FOUND = 104;
  private ERR_MILESTONE_NOT_APPROVED = 105;
  private ERR_INSUFFICIENT_FUNDS = 106;
  private ERR_CAMPAIGN_EXPIRED = 107;
  private ERR_INVALID_REGION = 108;
  private ERR_NOT_CREATOR = 109;
  private ERR_MAX_MILESTONES = 110;
  private ERR_ALREADY_INITIALIZED = 111;
  private ERR_INVALID_DURATION = 112;
  private MAX_MILESTONES = 10;
  private MIN_FUNDING_GOAL = 1000000;
  private MAX_DESCRIPTION_LEN = 500;
  private MAX_TITLE_LEN = 100;
  private MAX_REGION_LEN = 50;
  private MAX_EVIDENCE_LEN = 200;

  private allowedRegions = ["Africa", "South Asia", "Southeast Asia", "Latin America"];

  private isValidRegion(region: string): boolean {
    return this.allowedRegions.includes(region);
  }

  private isAdmin(caller: string): boolean {
    return caller === this.state.admin;
  }

  private isCampaignActive(campaignId: number): boolean {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign) return false;
    return (
      campaign.active &&
      !campaign.ended &&
      this.state.blockHeight <= campaign.deadline
    );
  }

  createCampaign(
    caller: string,
    title: string,
    description: string,
    region: string,
    fundingGoal: number,
    duration: number
  ): ClarityResponse<number> {
    if (
      title.length > this.MAX_TITLE_LEN ||
      description.length > this.MAX_DESCRIPTION_LEN ||
      region.length > this.MAX_REGION_LEN ||
      fundingGoal < this.MIN_FUNDING_GOAL ||
      duration <= 0 ||
      duration > 52560
    ) {
      return { ok: false, value: this.ERR_INVALID_INPUT };
    }
    if (!this.isValidRegion(region)) {
      return { ok: false, value: this.ERR_INVALID_REGION };
    }
    const campaignId = this.state.campaignCounter + 1;
    this.state.campaigns.set(campaignId, {
      creator: caller,
      title,
      description,
      region,
      fundingGoal,
      totalRaised: 0,
      deadline: this.state.blockHeight + duration,
      active: true,
      ended: false,
      createdAt: this.state.blockHeight,
    });
    this.state.campaignCounter = campaignId;
    return { ok: true, value: campaignId };
  }

  donate(caller: string, campaignId: number, amount: number): ClarityResponse<boolean> {
    if (!this.isCampaignActive(campaignId)) {
      return { ok: false, value: this.ERR_CAMPAIGN_EXPIRED };
    }
    if (amount <= 0) {
      return { ok: false, value: this.ERR_INVALID_INPUT };
    }
    const campaign = this.state.campaigns.get(campaignId)!;
    this.state.donations.set(`${campaignId}-${caller}`, {
      amount,
      timestamp: this.state.blockHeight,
    });
    this.state.campaigns.set(campaignId, {
      ...campaign,
      totalRaised: campaign.totalRaised + amount,
    });
    this.state.balances.set("contract", (this.state.balances.get("contract") || 0) + amount);
    return { ok: true, value: true };
  }

  addMilestone(
    caller: string,
    campaignId: number,
    milestoneId: number,
    description: string,
    amount: number
  ): ClarityResponse<boolean> {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign || !this.isCampaignActive(campaignId)) {
      return { ok: false, value: this.ERR_CAMPAIGN_EXPIRED };
    }
    if (caller !== campaign.creator) {
      return { ok: false, value: this.ERR_NOT_CREATOR };
    }
    if (milestoneId > this.MAX_MILESTONES || description.length > this.MAX_EVIDENCE_LEN || amount <= 0) {
      return { ok: false, value: this.ERR_INVALID_INPUT };
    }
    const milestoneKey = `${campaignId}-${milestoneId}`;
    if (this.state.milestones.has(milestoneKey)) {
      return { ok: false, value: this.ERR_ALREADY_INITIALIZED };
    }
    this.state.milestones.set(milestoneKey, {
      description,
      amount,
      approved: false,
      evidenceHash: null,
      submittedAt: null,
      approvedAt: null,
    });
    return { ok: true, value: true };
  }

  submitMilestoneEvidence(
    caller: string,
    campaignId: number,
    milestoneId: number,
    evidenceHash: string
  ): ClarityResponse<boolean> {
    const campaign = this.state.campaigns.get(campaignId);
    const milestoneKey = `${campaignId}-${milestoneId}`;
    const milestone = this.state.milestones.get(milestoneKey);
    if (!campaign || !milestone || !this.isCampaignActive(campaignId)) {
      return { ok: false, value: this.ERR_MILESTONE_NOT_FOUND };
    }
    if (caller !== campaign.creator) {
      return { ok: false, value: this.ERR_NOT_CREATOR };
    }
    if (milestone.approved) {
      return { ok: false, value: this.ERR_MILESTONE_NOT_APPROVED };
    }
    this.state.milestones.set(milestoneKey, {
      ...milestone,
      evidenceHash,
      submittedAt: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  approveMilestone(caller: string, campaignId: number, milestoneId: number): ClarityResponse<boolean> {
    const campaign = this.state.campaigns.get(campaignId);
    const milestoneKey = `${campaignId}-${milestoneId}`;
    const milestone = this.state.milestones.get(milestoneKey);
    if (!campaign || !milestone || !this.isCampaignActive(campaignId)) {
      return { ok: false, value: this.ERR_MILESTONE_NOT_FOUND };
    }
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (!milestone.evidenceHash) {
      return { ok: false, value: this.ERR_INVALID_INPUT };
    }
    if (campaign.totalRaised < milestone.amount) {
      return { ok: false, value: this.ERR_INSUFFICIENT_FUNDS };
    }
    this.state.balances.set("contract", (this.state.balances.get("contract") || 0) - milestone.amount);
    this.state.milestones.set(milestoneKey, {
      ...milestone,
      approved: true,
      approvedAt: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  endCampaign(caller: string, campaignId: number): ClarityResponse<boolean> {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign || !this.isCampaignActive(campaignId)) {
      return { ok: false, value: this.ERR_CAMPAIGN_EXPIRED };
    }
    if (!this.isAdmin(caller) && caller !== campaign.creator) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.campaigns.set(campaignId, {
      ...campaign,
      active: false,
      ended: true,
    });
    return { ok: true, value: true };
  }

  refundDonors(caller: string, campaignId: number): ClarityResponse<boolean> {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign) {
      return { ok: false, value: this.ERR_NOT_ACTIVE };
    }
    if (this.isCampaignActive(campaignId)) {
      return { ok: false, value: this.ERR_ALREADY_ENDED };
    }
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    return { ok: true, value: true };
  }

  getCampaign(campaignId: number): ClarityResponse<Campaign | null> {
    return { ok: true, value: this.state.campaigns.get(campaignId) ?? null };
  }

  getMilestone(campaignId: number, milestoneId: number): ClarityResponse<Milestone | null> {
    return { ok: true, value: this.state.milestones.get(`${campaignId}-${milestoneId}`) ?? null };
  }

  getDonation(campaignId: number, donor: string): ClarityResponse<Donation | null> {
    return { ok: true, value: this.state.donations.get(`${campaignId}-${donor}`) ?? null };
  }

  getCampaignCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.campaignCounter };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  creator: "wallet_1",
  donor: "wallet_2",
  user: "wallet_3",
};

describe("Campaign Contract", () => {
  let contract: CampaignMock;

  beforeEach(() => {
    contract = new CampaignMock();
    vi.resetAllMocks();
  });

  it("should create a campaign successfully", () => {
    const result = contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a primary school in rural Africa",
      "Africa",
      10000000,
      1000
    );
    expect(result).toEqual({ ok: true, value: 1 });
    const campaign = contract.getCampaign(1);
    expect(campaign).toEqual({
      ok: true,
      value: expect.objectContaining({
        creator: accounts.creator,
        title: "Build a School",
        region: "Africa",
        fundingGoal: 10000000,
        totalRaised: 0,
        active: true,
        ended: false,
      }),
    });
  });

  it("should reject invalid region", () => {
    const result = contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Europe",
      10000000,
      1000
    );
    expect(result).toEqual({ ok: false, value: 108 });
  });

  it("should reject invalid input (low funding goal)", () => {
    const result = contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      100000,
      1000
    );
    expect(result).toEqual({ ok: false, value: 101 });
  });

  it("should allow donations to active campaign", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    const donateResult = contract.donate(accounts.donor, 1, 5000000);
    expect(donateResult).toEqual({ ok: true, value: true });
    const campaign = contract.getCampaign(1);
    expect(campaign).toEqual({
      ok: true,
      value: expect.objectContaining({ totalRaised: 5000000 }),
    });
    const donation = contract.getDonation(1, accounts.donor);
    expect(donation).toEqual({
      ok: true,
      value: expect.objectContaining({ amount: 5000000 }),
    });
  });

  it("should allow creator to add milestone", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    const result = contract.addMilestone(
      accounts.creator,
      1,
      1,
      "Complete foundation",
      2000000
    );
    expect(result).toEqual({ ok: true, value: true });
    const milestone = contract.getMilestone(1, 1);
    expect(milestone).toEqual({
      ok: true,
      value: expect.objectContaining({
        description: "Complete foundation",
        amount: 2000000,
        approved: false,
      }),
    });
  });

  it("should reject milestone from non-creator", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    const result = contract.addMilestone(
      accounts.user,
      1,
      1,
      "Complete foundation",
      2000000
    );
    expect(result).toEqual({ ok: false, value: 109 });
  });

  it("should allow creator to submit milestone evidence", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    contract.addMilestone(accounts.creator, 1, 1, "Complete foundation", 2000000);
    const result = contract.submitMilestoneEvidence(
      accounts.creator,
      1,
      1,
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    );
    expect(result).toEqual({ ok: true, value: true });
    const milestone = contract.getMilestone(1, 1);
    expect(milestone).toEqual({
      ok: true,
      value: expect.objectContaining({
        evidenceHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      }),
    });
  });

  it("should allow admin to approve milestone", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    contract.addMilestone(accounts.creator, 1, 1, "Complete foundation", 2000000);
    contract.donate(accounts.donor, 1, 5000000);
    contract.submitMilestoneEvidence(
      accounts.creator,
      1,
      1,
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    );
    const result = contract.approveMilestone(accounts.deployer, 1, 1);
    expect(result).toEqual({ ok: true, value: true });
    const milestone = contract.getMilestone(1, 1);
    expect(milestone).toEqual({
      ok: true,
      value: expect.objectContaining({ approved: true }),
    });
  });

  it("should reject milestone approval with insufficient funds", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    contract.addMilestone(accounts.creator, 1, 1, "Complete foundation", 2000000);
    contract.submitMilestoneEvidence(
      accounts.creator,
      1,
      1,
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    );
    const result = contract.approveMilestone(accounts.deployer, 1, 1);
    expect(result).toEqual({ ok: false, value: 106 });
  });

  it("should allow admin or creator to end campaign", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    const result = contract.endCampaign(accounts.creator, 1);
    expect(result).toEqual({ ok: true, value: true });
    const campaign = contract.getCampaign(1);
    expect(campaign).toEqual({
      ok: true,
      value: expect.objectContaining({ active: false, ended: true }),
    });
  });

  it("should allow admin to refund donors", () => {
    contract.createCampaign(
      accounts.creator,
      "Build a School",
      "Construct a school",
      "Africa",
      10000000,
      1000
    );
    contract.endCampaign(accounts.creator, 1);
    const result = contract.refundDonors(accounts.deployer, 1);
    expect(result).toEqual({ ok: true, value: true });
  });
});