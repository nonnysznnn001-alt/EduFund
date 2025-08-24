# 📚 EduFund: Blockchain-based Crowdfunding for Education in Developing Regions

Welcome to EduFund, a decentralized platform that empowers communities in developing regions to crowdfund educational projects! Using the Stacks blockchain and Clarity smart contracts, this project addresses the real-world problem of limited access to funding for education in underserved areas. It ensures transparency, reduces intermediary fees, and enables global donors to support initiatives like school construction, teacher training, scholarships, and digital learning tools—all while preventing fraud through immutable records and milestone-based releases.

## ✨ Features
🌍 Create campaigns for educational projects with detailed descriptions, goals, and milestones  
💰 Secure donations in STX or platform tokens, with automatic escrow for accountability  
🗳️ Community voting on fund releases to ensure projects meet milestones  
✅ Milestone verification with oracle integration for real-world proof (e.g., photos or reports)  
🎁 Donor rewards via NFTs or tokens for contributions  
🔒 User registration with basic KYC-like verification to build trust  
📊 Transparent tracking of funds, donations, and project progress  
🚫 Anti-fraud measures like unique campaign IDs and duplicate prevention  
🌐 Global accessibility for donors and project creators in developing regions  

## 🛠 How It Works
EduFund leverages 8 Clarity smart contracts to handle different aspects of the platform, ensuring modularity, security, and scalability. Here's a high-level overview:

### Smart Contracts
1. **UserRegistry**: Manages user registrations, including basic profiles and verification status to ensure credible project creators.  
2. **CampaignFactory**: Deploys new campaign instances, enforcing rules like minimum funding goals and regional focus.  
3. **Campaign**: Core contract for each project, tracking goals, milestones, donations, and status updates.  
4. **Escrow**: Holds donated funds securely until milestones are approved, with timed refunds if goals aren't met.  
5. **Voting**: Enables token holders or donors to vote on milestone completions and fund releases.  
6. **MilestoneManager**: Handles creation, submission, and verification of project milestones, integrating with oracles for external data.  
7. **RewardToken**: An SIP-010 compliant fungible token for platform governance and donor incentives.  
8. **NFTDistributor**: Mints and distributes NFTs as rewards for donors, representing "impact badges" for supported projects.  

**For Project Creators**  
- Register via UserRegistry to verify your identity and region.  
- Use CampaignFactory to launch a campaign with a title, description, funding goal, and milestones.  
- Submit progress updates to MilestoneManager for verification.  
- Once milestones are voted on and approved via Voting, funds are released from Escrow.  

**For Donors**  
- Browse active campaigns and donate STX or RewardTokens directly to a Campaign contract.  
- Funds go into Escrow for safety.  
- Participate in Voting if you hold tokens or meet donation thresholds.  
- Receive NFTs from NFTDistributor as proof of impact and potential rewards.  

**For Verifiers/Community**  
- Check campaign details and milestones using read-only functions in Campaign and MilestoneManager.  
- Use Voting to approve or reject fund releases based on submitted evidence.  

That's it! EduFund brings transparent, efficient crowdfunding to education, helping bridge the gap in developing regions while leveraging blockchain's power for trust and inclusion. Get started by deploying the contracts on Stacks testnet and building your frontend dApp!