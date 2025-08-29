// tests/nft-minter.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface GpsCoordinates {
  lat: number;
  long: number;
}

interface NftMetadata {
  areaId: number;
  gpsCoordinates: GpsCoordinates;
  description: string;
  imageUri: string;
  conservationGoals: string[];
  mintTimestamp: number;
  royaltyPercentage: number;
  royaltyRecipient: string;
}

interface NftStatus {
  status: string;
  lastUpdated: number;
}

interface ContractState {
  lastNftId: number;
  contractPaused: boolean;
  admin: string;
  nfts: Map<number, { owner: string }>; // Simulates NFT ownership
  nftMetadata: Map<number, NftMetadata>;
  areaToNft: Map<number, { nftId: number }>;
  minters: Map<string, { active: boolean }>;
  nftTags: Map<number, { tags: string[] }>;
  nftStatus: Map<number, NftStatus>;
}

// Mock contract implementation
class NftMinterMock {
  private state: ContractState = {
    lastNftId: 0,
    contractPaused: false,
    admin: "deployer",
    nfts: new Map(),
    nftMetadata: new Map(),
    areaToNft: new Map(),
    minters: new Map([["deployer", { active: true }]]),
    nftTags: new Map(),
    nftStatus: new Map(),
  };

  private MAX_METADATA_LEN = 512;
  private MAX_GOALS_LEN = 5;
  private MAX_TAGS_LEN = 10;
  private ERR_UNAUTHORIZED = 100;
  private ERR_PAUSED = 101;
  private ERR_INVALID_AREA_ID = 102;
  private ERR_INVALID_METADATA = 103;
  private ERR_NFT_ALREADY_EXISTS = 104;
  private ERR_INVALID_RECIPIENT = 105;
  private ERR_INVALID_MINTER = 106;
  private ERR_ALREADY_REGISTERED = 107;
  private ERR_METADATA_TOO_LONG = 108;
  private ERR_INVALID_GPS = 109;
  private ERR_INVALID_GOALS = 110;
  private ERR_INVALID_ROYALTY = 111;
  private ERR_NOT_OWNER = 112;
  private ERR_INVALID_UPDATE = 113;

  private currentBlockHeight = 1000; // Mock block height

  // Helper to simulate block height increase
  private incrementBlockHeight() {
    this.currentBlockHeight += 1;
  }

  mintNft(
    caller: string,
    areaId: number,
    gps: GpsCoordinates,
    description: string,
    imageUri: string,
    conservationGoals: string[],
    royaltyPercentage: number,
    royaltyRecipient: string,
    recipient: string,
    tags: string[]
  ): ClarityResponse<number> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.minters.get(caller)?.active) {
      return { ok: false, value: this.ERR_INVALID_MINTER };
    }
    if (areaId <= 0) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    if (this.state.areaToNft.has(areaId)) {
      return { ok: false, value: this.ERR_NFT_ALREADY_EXISTS };
    }
    if (recipient === "deployer") {
      return { ok: false, value: this.ERR_INVALID_RECIPIENT };
    }
    if (
      gps.lat < -90000000 ||
      gps.lat > 90000000 ||
      gps.long < -180000000 ||
      gps.long > 180000000
    ) {
      return { ok: false, value: this.ERR_INVALID_GPS };
    }
    if (conservationGoals.length === 0 || conservationGoals.length > this.MAX_GOALS_LEN) {
      return { ok: false, value: this.ERR_INVALID_GOALS };
    }
    if (description.length > this.MAX_METADATA_LEN || imageUri.length > 256) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    if (royaltyPercentage < 0 || royaltyPercentage > 10000) {
      return { ok: false, value: this.ERR_INVALID_ROYALTY };
    }
    if (tags.length > this.MAX_TAGS_LEN) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }

    const newNftId = this.state.lastNftId + 1;
    this.state.nfts.set(newNftId, { owner: recipient });
    this.state.nftMetadata.set(newNftId, {
      areaId,
      gpsCoordinates: gps,
      description,
      imageUri,
      conservationGoals,
      mintTimestamp: this.currentBlockHeight,
      royaltyPercentage,
      royaltyRecipient,
    });
    this.state.areaToNft.set(areaId, { nftId: newNftId });
    this.state.nftTags.set(newNftId, { tags });
    this.state.nftStatus.set(newNftId, {
      status: "active",
      lastUpdated: this.currentBlockHeight,
    });
    this.state.lastNftId = newNftId;
    this.incrementBlockHeight();
    return { ok: true, value: newNftId };
  }

  transfer(caller: string, nftId: number, sender: string, recipient: string): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (caller !== sender) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const nft = this.state.nfts.get(nftId);
    if (!nft) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    if (nft.owner !== sender) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.nfts.set(nftId, { owner: recipient });
    return { ok: true, value: true };
  }

  updateMetadata(caller: string, nftId: number, newDescription: string, newImageUri: string): ClarityResponse<boolean> {
    const nft = this.state.nfts.get(nftId);
    if (!nft) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    if (caller !== nft.owner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (newDescription.length > this.MAX_METADATA_LEN || newImageUri.length > 256) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    const currentMetadata = this.state.nftMetadata.get(nftId);
    if (!currentMetadata) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    this.state.nftMetadata.set(nftId, {
      ...currentMetadata,
      description: newDescription,
      imageUri: newImageUri,
    });
    const currentStatus = this.state.nftStatus.get(nftId);
    if (currentStatus) {
      this.state.nftStatus.set(nftId, {
        ...currentStatus,
        lastUpdated: this.currentBlockHeight,
      });
    }
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  updateGoals(caller: string, nftId: number, newGoals: string[]): ClarityResponse<boolean> {
    const nft = this.state.nfts.get(nftId);
    if (!nft) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    if (caller !== nft.owner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (newGoals.length === 0 || newGoals.length > this.MAX_GOALS_LEN) {
      return { ok: false, value: this.ERR_INVALID_GOALS };
    }
    const currentMetadata = this.state.nftMetadata.get(nftId);
    if (!currentMetadata) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    this.state.nftMetadata.set(nftId, {
      ...currentMetadata,
      conservationGoals: newGoals,
    });
    const currentStatus = this.state.nftStatus.get(nftId);
    if (currentStatus) {
      this.state.nftStatus.set(nftId, {
        ...currentStatus,
        lastUpdated: this.currentBlockHeight,
      });
    }
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  updateStatus(caller: string, nftId: number, newStatus: string): ClarityResponse<boolean> {
    const nft = this.state.nfts.get(nftId);
    if (!nft) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    const isOwner = caller === nft.owner;
    const isMinter = this.state.minters.get(caller)?.active ?? false;
    if (!isOwner && !isMinter) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newStatus.length > 20) {
      return { ok: false, value: this.ERR_INVALID_UPDATE };
    }
    this.state.nftStatus.set(nftId, {
      status: newStatus,
      lastUpdated: this.currentBlockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  addTags(caller: string, nftId: number, newTags: string[]): ClarityResponse<boolean> {
    const nft = this.state.nfts.get(nftId);
    if (!nft) {
      return { ok: false, value: this.ERR_INVALID_AREA_ID };
    }
    if (caller !== nft.owner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const currentTags = this.state.nftTags.get(nftId)?.tags ?? [];
    if (currentTags.length + newTags.length > this.MAX_TAGS_LEN) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    this.state.nftTags.set(nftId, { tags: [...currentTags, ...newTags] });
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.contractPaused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.contractPaused = false;
    return { ok: true, value: true };
  }

  addMinter(caller: string, newMinter: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (this.state.minters.has(newMinter)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    this.state.minters.set(newMinter, { active: true });
    return { ok: true, value: true };
  }

  removeMinter(caller: string, minterToRemove: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.minters.set(minterToRemove, { active: false });
    return { ok: true, value: true };
  }

  getLastNftId(): ClarityResponse<number> {
    return { ok: true, value: this.state.lastNftId };
  }

  getNftMetadata(nftId: number): ClarityResponse<NftMetadata | undefined> {
    return { ok: true, value: this.state.nftMetadata.get(nftId) };
  }

  getNftByArea(areaId: number): ClarityResponse<{ nftId: number } | undefined> {
    return { ok: true, value: this.state.areaToNft.get(areaId) };
  }

  getNftOwner(nftId: number): ClarityResponse<string | undefined> {
    return { ok: true, value: this.state.nfts.get(nftId)?.owner };
  }

  getNftTags(nftId: number): ClarityResponse<string[] | undefined> {
    return { ok: true, value: this.state.nftTags.get(nftId)?.tags };
  }

  getNftStatus(nftId: number): ClarityResponse<NftStatus | undefined> {
    return { ok: true, value: this.state.nftStatus.get(nftId) };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.contractPaused };
  }

  getAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }

  checkIsMinter(account: string): ClarityResponse<boolean> {
    return { ok: true, value: this.state.minters.get(account)?.active ?? false };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  minter: "wallet_1",
  user1: "wallet_2",
  user2: "wallet_3",
};

describe("NftMinter Contract", () => {
  let contract: NftMinterMock;

  beforeEach(() => {
    contract = new NftMinterMock();
    vi.resetAllMocks();
  });

  it("should allow minter to mint NFT with valid data", () => {
    const mintResult = contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Protected rainforest area",
      "https://example.com/image.jpg",
      ["Plant 1000 trees", "Protect wildlife"],
      1000,
      accounts.deployer,
      accounts.user1,
      ["eco", "conservation"]
    );
    expect(mintResult).toEqual({ ok: true, value: 1 });
    expect(contract.getNftOwner(1)).toEqual({ ok: true, value: accounts.user1 });
    expect(contract.getNftMetadata(1)).toEqual({
      ok: true,
      value: expect.objectContaining({
        areaId: 1,
        description: "Protected rainforest area",
        conservationGoals: ["Plant 1000 trees", "Protect wildlife"],
      }),
    });
    expect(contract.getNftTags(1)).toEqual({ ok: true, value: ["eco", "conservation"] });
    expect(contract.getNftStatus(1)).toEqual({
      ok: true,
      value: { status: "active", lastUpdated: 1000 },
    });
  });

  it("should prevent non-minter from minting", () => {
    const mintResult = contract.mintNft(
      accounts.user1,
      1,
      { lat: 37700000, long: -122400000 },
      "Protected area",
      "https://example.com/image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user2,
      []
    );
    expect(mintResult).toEqual({ ok: false, value: 106 });
  });

  it("should prevent minting duplicate area ID", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Area1",
      "https://example.com/image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const duplicateMint = contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Area1 duplicate",
      "https://example.com/image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user2,
      []
    );
    expect(duplicateMint).toEqual({ ok: false, value: 104 });
  });

  it("should allow owner to transfer NFT", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Area1",
      "https://example.com/image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const transferResult = contract.transfer(accounts.user1, 1, accounts.user1, accounts.user2);
    expect(transferResult).toEqual({ ok: true, value: true });
    expect(contract.getNftOwner(1)).toEqual({ ok: true, value: accounts.user2 });
  });

  it("should prevent non-owner from transferring", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Area1",
      "https://example.com/image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const transferResult = contract.transfer(accounts.user2, 1, accounts.user1, accounts.user2);
    expect(transferResult).toEqual({ ok: false, value: 100 });
  });

  it("should allow owner to update metadata", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Original desc",
      "original.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const updateResult = contract.updateMetadata(accounts.user1, 1, "New desc", "new.jpg");
    expect(updateResult).toEqual({ ok: true, value: true });
    expect(contract.getNftMetadata(1)).toEqual({
      ok: true,
      value: expect.objectContaining({
        description: "New desc",
        imageUri: "new.jpg",
      }),
    });
    expect(contract.getNftStatus(1)).toEqual({
      ok: true,
      value: { status: "active", lastUpdated: 1001 },
    });
  });

  it("should prevent non-owner from updating metadata", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Desc",
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const updateResult = contract.updateMetadata(accounts.user2, 1, "New desc", "new.jpg");
    expect(updateResult).toEqual({ ok: false, value: 112 });
  });

  it("should allow owner to update goals", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Desc",
      "image.jpg",
      ["Old goal"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const updateResult = contract.updateGoals(accounts.user1, 1, ["New goal1", "New goal2"]);
    expect(updateResult).toEqual({ ok: true, value: true });
    expect(contract.getNftMetadata(1)).toEqual({
      ok: true,
      value: expect.objectContaining({
        conservationGoals: ["New goal1", "New goal2"],
      }),
    });
  });

  it("should allow minter or owner to update status", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Desc",
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const updateByOwner = contract.updateStatus(accounts.user1, 1, "funded");
    expect(updateByOwner).toEqual({ ok: true, value: true });
    expect(contract.getNftStatus(1)).toEqual({
      ok: true,
      value: { status: "funded", lastUpdated: 1001 },
    });

    const updateByMinter = contract.updateStatus(accounts.deployer, 1, "protected");
    expect(updateByMinter).toEqual({ ok: true, value: true });
    expect(contract.getNftStatus(1)).toEqual({
      ok: true,
      value: { status: "protected", lastUpdated: 1002 },
    });
  });

  it("should prevent unauthorized from updating status", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Desc",
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    const updateResult = contract.updateStatus(accounts.user2, 1, "new");
    expect(updateResult).toEqual({ ok: false, value: 100 });
  });

  it("should allow owner to add tags", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Desc",
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      ["tag1"]
    );
    const addResult = contract.addTags(accounts.user1, 1, ["tag2", "tag3"]);
    expect(addResult).toEqual({ ok: true, value: true });
    expect(contract.getNftTags(1)).toEqual({ ok: true, value: ["tag1", "tag2", "tag3"] });
  });

  it("should prevent adding too many tags", () => {
    contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Desc",
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      Array(10).fill("tag")
    );
    const addResult = contract.addTags(accounts.user1, 1, ["extra"]);
    expect(addResult).toEqual({ ok: false, value: 103 });
  });

  it("should allow admin to add minter", () => {
    const addResult = contract.addMinter(accounts.deployer, accounts.minter);
    expect(addResult).toEqual({ ok: true, value: true });
    expect(contract.checkIsMinter(accounts.minter)).toEqual({ ok: true, value: true });
  });

  it("should prevent non-admin from adding minter", () => {
    const addResult = contract.addMinter(accounts.user1, accounts.minter);
    expect(addResult).toEqual({ ok: false, value: 100 });
  });

  it("should allow admin to pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const mintDuringPause = contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      "Desc",
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    expect(mintDuringPause).toEqual({ ok: false, value: 101 });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent minting with invalid GPS", () => {
    const mintResult = contract.mintNft(
      accounts.deployer,
      1,
      { lat: 100000000, long: -122400000 }, // Invalid lat
      "Desc",
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    expect(mintResult).toEqual({ ok: false, value: 109 });
  });

  it("should prevent minting with too long metadata", () => {
    const longDesc = "a".repeat(513);
    const mintResult = contract.mintNft(
      accounts.deployer,
      1,
      { lat: 37700000, long: -122400000 },
      longDesc,
      "image.jpg",
      ["Goal1"],
      500,
      accounts.deployer,
      accounts.user1,
      []
    );
    expect(mintResult).toEqual({ ok: false, value: 103 });
  });
});