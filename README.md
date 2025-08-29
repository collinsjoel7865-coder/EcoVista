# 🌿 EcoVista: Decentralized Marketplace for Eco-Tourism NFTs

Welcome to EcoVista, a groundbreaking Web3 platform that addresses the real-world problem of underfunded conservation efforts by enabling virtual ownership of protected natural areas through NFTs. Users can purchase NFTs representing shares or virtual "deeds" to eco-sensitive regions, with proceeds directly funding on-ground conservation projects. This reduces the environmental impact of physical tourism while democratizing access to nature preservation. Built on the Stacks blockchain using Clarity smart contracts, EcoVista ensures transparency, immutability, and community-driven governance for sustainable impact.

## ✨ Features

🌍 Virtual ownership of protected areas via unique NFTs  
💰 Direct funding to conservation organizations through NFT sales and royalties  
🛒 Decentralized marketplace for buying, selling, and trading eco-NFTs  
📈 Staking mechanism to earn rewards for long-term holders supporting conservation  
🗳️ Community governance for voting on fund allocation and project proposals  
🔒 Oracle integration for verifying real-world conservation milestones  
🔄 Royalty system ensuring ongoing funding from secondary market sales  
📊 Transparent fund tracking with immutable on-chain records  
🎟️ Auction system for exclusive or limited-edition eco-NFT drops  
🌱 Eco-rewards token for incentives like virtual tours or carbon offset credits

## 🛠 How It Works

EcoVista leverages 8 interconnected Clarity smart contracts to create a seamless, trustless ecosystem. Here's a high-level overview:

### Core Components
- **NFT-Minter Contract**: Handles the creation and minting of eco-NFTs. Each NFT is tied to a specific protected area (e.g., a rainforest plot) with metadata like GPS coordinates, images, and conservation goals. Users or admins (e.g., partnered NGOs) call `mint-nft` with area details to generate unique tokens.
- **Marketplace Contract**: Enables peer-to-peer trading of NFTs. Users list NFTs for sale using `list-nft`, set prices, and buyers execute `buy-nft`. Includes support for fixed-price sales and offers.
- **Auction Contract**: For initial or special NFT drops, this contract manages timed auctions. Call `start-auction` with NFT ID, starting bid, and duration; highest bidder wins via `place-bid` and `end-auction`.
- **Royalty-Distributor Contract**: Automatically enforces royalties on secondary sales (e.g., 10% fee). When an NFT is sold on the marketplace, `distribute-royalty` funnels a portion back to conservation funds.
- **Staking Contract**: Holders stake their NFTs via `stake-nft` to earn rewards. Staked assets lock for periods, generating eco-tokens based on time and conservation impact metrics.
- **Eco-Token Contract**: A fungible token (SIP-010 compliant) used for payments, rewards, and incentives. Functions like `mint-tokens` for rewards and `transfer` for transactions.
- **Governance Contract**: Allows eco-token holders to propose and vote on initiatives (e.g., fund new projects). Use `submit-proposal` and `vote` to decide on allocations.
- **Oracle-Verifier Contract**: Integrates off-chain data (e.g., via trusted oracles) to confirm real-world milestones like tree planting or wildlife protection. Call `submit-verification` to update on-chain status, triggering rewards.

**For Users (Eco-Tourists and Investors)**  
- Browse available eco-NFTs on the marketplace.  
- Participate in auctions or buy directly using STX or eco-tokens.  
- Stake your NFT to earn rewards and support long-term conservation.  
- Vote in governance to influence how funds are used.  

**For Conservation Partners**  
- Mint NFTs for new protected areas.  
- Submit verifications via oracle to unlock additional funding.  
- Track transparent fund flows from royalties and sales.  

**Funding Flow**  
Proceeds from primary sales and royalties are automatically distributed: 70% to conservation orgs, 20% to platform treasury for development, 10% to stakers as rewards. All transactions are immutable on Stacks, ensuring accountability.

This setup solves funding gaps in conservation by turning virtual engagement into real-world impact, while involving 8 smart contracts for a robust, scalable system. Deploy on Stacks for low-cost, Bitcoin-secured operations!