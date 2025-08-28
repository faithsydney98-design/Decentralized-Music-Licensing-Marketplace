# TuneLicense: Decentralized Music Licensing Marketplace

## Overview

TuneLicense is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It creates a decentralized marketplace where musicians and artists can directly license their music to filmmakers, brands, and other creators. By leveraging blockchain technology, the platform eliminates intermediaries, ensures transparent and automated enforcement of licensing terms via smart contracts, and solves key real-world problems in the music industry.

### Real-World Problems Solved
- **Intermediary Exploitation**: Traditional licensing involves labels, agents, and platforms that take large cuts (often 30-50%), leaving artists with minimal earnings. TuneLicense enables direct peer-to-peer transactions, ensuring artists retain more control and revenue.
- **Opaque and Delayed Payments**: Royalty tracking and payments are often delayed or disputed due to lack of transparency. Smart contracts automate instant payments, escrows, and royalty distributions based on predefined terms.
- **Complex Licensing Processes**: Negotiating licenses is time-consuming and prone to legal disputes. The platform standardizes licenses with customizable smart contract templates, reducing friction and enforcing terms automatically (e.g., usage limits, revocation on breach).
- **Intellectual Property Theft and Tracking**: Music piracy and unauthorized use are rampant. By minting tracks as NFTs, ownership is verifiable on-chain, and licenses can include usage tracking hooks (e.g., via oracles for play counts).
- **Lack of Global Accessibility**: Emerging artists in underserved regions struggle to reach global buyers. A decentralized marketplace democratizes access, allowing anyone with a wallet to participate without geographic or institutional barriers.
- **Dispute Resolution Inefficiencies**: Legal battles over breaches are costly. Integrated governance and escrow mechanisms provide on-chain dispute handling, reducing reliance on courts.

The platform uses STX (Stacks' native token) for transactions, with optional integration for stablecoins via token bridges. Users interact via a dApp frontend (not included in this repo; assume built with React/Clarity SDK).

## Architecture

TuneLicense consists of 6 core smart contracts written in Clarity, deployed on the Stacks blockchain. These contracts interact to form a secure, decentralized system:

1. **RegistryContract**: Manages user profiles and roles.
2. **TrackContract**: Handles music track minting and metadata as NFTs.
3. **MarketplaceContract**: Facilitates listing, browsing, and initial license negotiations.
4. **LicenseContract**: Defines and enforces customizable license agreements.
5. **EscrowContract**: Secures payments and handles conditional releases.
6. **RoyaltyContract**: Automates ongoing royalty distributions.

Contracts are designed with Clarity's safety features: no reentrancy risks, explicit error handling, and functional programming paradigms. All contracts are ownable or governed by a DAO for upgrades.

### Key Features
- **Direct Licensing**: Artists list tracks; buyers propose terms; smart contracts auto-enforce.
- **NFT-Based Ownership**: Tracks are minted as SIP-009 compliant NFTs for provenance.
- **Automated Royalties**: Split payments (e.g., 70% to artist, 30% to collaborators) on every use or resale.
- **Escrow for Trust**: Funds held until license conditions are met (e.g., delivery of stems).
- **Governance Integration**: Future DAO voting for platform fees or dispute resolutions (via RoyaltyContract's extension).

## Smart Contracts

Below is a high-level description of each contract, including key functions, traits, and interactions. Full Clarity code would be in separate `.clar` files (e.g., `registry.clar`). This README outlines the logic; implement accordingly.

### 1. RegistryContract
- **Purpose**: Registers users as artists, buyers (filmmakers/brands), or collaborators. Stores profiles (e.g., bio, wallet address) and verifies identities (optional KYC hook via oracles).
- **Traits Implemented**: Ownable (for admin functions).
- **Key Data Maps**:
  - `users`: (principal -> {role: (string-ascii 20), profile: (buff 512), verified: bool})
- **Public Functions**:
  - `register-user (role: string-ascii, profile: buff)`: Registers caller with role ("artist", "buyer", etc.).
  - `update-profile (profile: buff)`: Updates caller's profile.
  - `get-user (user: principal)`: Returns user details.
- **Private Functions**:
  - Validation for unique registrations.
- **Interactions**: Called by other contracts to check roles (e.g., only artists can mint tracks).
- **Real-World Tie-In**: Solves accessibility by allowing pseudonymous participation while supporting verification for trust.

### 2. TrackContract
- **Purpose**: Mints music tracks as NFTs, storing metadata (e.g., IPFS hash for audio file, title, genre).
- **Traits Implemented**: SIP-009 (NFT standard on Stacks).
- **Key Data Maps**:
  - `tracks`: (uint -> {owner: principal, metadata: (buff 1024), listed: bool})
  - `track-counter`: uint (auto-increments for token IDs).
- **Public Functions**:
  - `mint-track (metadata: buff)`: Mints NFT for caller (artist role required via Registry).
  - `transfer-track (track-id: uint, recipient: principal)`: Standard NFT transfer.
  - `get-track-metadata (track-id: uint)`: Returns metadata.
- **Private Functions**:
  - IPFS hash validation.
- **Interactions**: MarketplaceContract lists minted tracks; LicenseContract references track-ids.
- **Real-World Tie-In**: Provides immutable proof of ownership, reducing IP disputes.

### 3. MarketplaceContract
- **Purpose**: A listing hub where artists post tracks for licensing, and buyers browse/search.
- **Traits Implemented**: None (composes others).
- **Key Data Maps**:
  - `listings`: (uint -> {track-id: uint, price: uint, terms-summary: (buff 256), active: bool})
  - `listing-counter`: uint.
- **Public Functions**:
  - `create-listing (track-id: uint, price: uint, terms-summary: buff)`: Lists a track (owner only).
  - `browse-listings (offset: uint, limit: uint)`: Returns paginated listings.
  - `propose-license (listing-id: uint, custom-terms: buff)`: Buyer proposes; triggers LicenseContract.
  - `remove-listing (listing-id: uint)`: Owner removes.
- **Private Functions**:
  - Role checks via Registry.
- **Interactions**: Calls TrackContract for ownership; forwards to LicenseContract for agreements.
- **Real-World Tie-In**: Streamlines discovery, replacing centralized platforms like AudioJungle.

### 4. LicenseContract
- **Purpose**: Creates enforceable license agreements with terms like duration, usage rights, and revocation conditions.
- **Traits Implemented**: Ownable.
- **Key Data Maps**:
  - `licenses`: (uint -> {track-id: uint, licensor: principal, licensee: principal, terms: {duration: uint, usage-type: (string-ascii 50), price: uint, active: bool}})
  - `license-counter`: uint.
- **Public Functions**:
  - `create-license (track-id: uint, licensee: principal, terms: {duration: uint, usage-type: string-ascii, price: uint})`: Creates and activates (after Escrow payment).
  - `enforce-license (license-id: uint)`: Checks conditions (e.g., expiry); auto-revokes if breached.
  - `get-license (license-id: uint)`: Returns details.
- **Private Functions**:
  - Term validation (e.g., usage-type enums: "commercial", "non-commercial").
- **Interactions**: Triggered by Marketplace; uses Escrow for payment; calls Royalty for distributions.
- **Real-World Tie-In**: Automates enforcement, preventing unauthorized use without manual legal action.

### 5. EscrowContract
- **Purpose**: Holds funds in escrow until license conditions are fulfilled (e.g., music delivery confirmed).
- **Traits Implemented**: FT-trait for STX handling.
- **Key Data Maps**:
  - `escrows`: (uint -> {amount: uint, sender: principal, recipient: principal, license-id: uint, released: bool})
  - `escrow-counter`: uint.
- **Public Functions**:
  - `create-escrow (amount: uint, recipient: principal, license-id: uint)`: Locks funds.
  - `release-escrow (escrow-id: uint)`: Releases to recipient if conditions met (e.g., license active).
  - `refund-escrow (escrow-id: uint)`: Refunds if dispute or breach.
- **Private Functions**:
  - Condition checks via LicenseContract.
- **Interactions**: Integrated with License and Royalty; uses STX transfers.
- **Real-World Tie-In**: Builds trust in transactions, reducing fraud in direct deals.

### 6. RoyaltyContract
- **Purpose**: Manages automated royalty splits for ongoing payments (e.g., per-stream royalties if integrated with oracles).
- **Traits Implemented**: FT-trait.
- **Key Data Maps**:
  - `royalty-splits`: (uint -> (list 10 {beneficiary: principal, percentage: uint}))  // Track-id -> splits (sum to 100%).
  - `payouts`: (uint -> uint)  // Accumulated royalties per track.
- **Public Functions**:
  - `set-royalty-split (track-id: uint, splits: (list 10 {beneficiary: principal, percentage: uint}))`: Sets splits (owner only).
  - `distribute-royalties (track-id: uint, amount: uint)`: Distributes amount per splits.
  - `claim-royalty (track-id: uint)`: Beneficiary claims share.
- **Private Functions**:
  - Percentage validation (sums to 100).
- **Interactions**: Called by Escrow on releases; extensible for oracle-based triggers (e.g., play counts).
- **Real-World Tie-In**: Ensures fair, transparent revenue sharing, addressing artist underpayment.

## Deployment and Usage
- **Prerequisites**: Stacks Wallet, Clarity CLI.
- **Deploy**: Use `clarinet deploy` for local testing; then to Stacks testnet/mainnet.
- **Testing**: Write tests in Clarity (e.g., for each contract's functions).
- **Frontend Integration**: Use @stacks/connect for dApp interactions.
- **Security**: All contracts use `post-condition` for asset transfers; audit recommended.

## Future Enhancements
- Oracle integration for real-time usage tracking.
- DAO governance for fee adjustments.
- Multi-token support (e.g., SIP-010 fungibles).

## License
MIT License. Contribute via PRs!