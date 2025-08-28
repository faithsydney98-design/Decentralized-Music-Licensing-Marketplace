import { describe, expect, it, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface TrackRecord {
  owner: string;
  metadata: string;
  timestamp: number;
  title: string;
  description: string;
}

interface VersionRecord {
  updatedMetadata: string;
  updateNotes: string;
  timestamp: number;
}

interface LicenseRecord {
  expiry: number;
  terms: string;
  active: boolean;
}

interface CategoryRecord {
  category: string;
  tags: string[];
}

interface CollaboratorRecord {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface StatusRecord {
  status: string;
  visibility: boolean;
  lastUpdated: number;
}

interface RevenueShareRecord {
  percentage: number;
  totalReceived: number;
}

interface ContractState {
  tracks: Map<number, TrackRecord>;
  versionRegistry: Map<string, VersionRecord>; // key: `${tokenId}-${version}`
  licenses: Map<string, LicenseRecord>; // key: `${tokenId}-${licensee}`
  workCategories: Map<number, CategoryRecord>;
  collaborators: Map<string, CollaboratorRecord>; // key: `${tokenId}-${collaborator}`
  workStatus: Map<number, StatusRecord>;
  revenueShares: Map<string, RevenueShareRecord>; // key: `${tokenId}-${participant}`
  lastTokenId: number;
  paused: boolean;
  admin: string;
}

// Mock contract implementation
class TrackContractMock {
  private state: ContractState = {
    tracks: new Map(),
    versionRegistry: new Map(),
    licenses: new Map(),
    workCategories: new Map(),
    collaborators: new Map(),
    workStatus: new Map(),
    revenueShares: new Map(),
    lastTokenId: 0,
    paused: false,
    admin: "deployer",
  };

  private MAX_METADATA_LEN = 1024;
  private MAX_TAGS = 10;
  private MAX_PERMISSIONS = 5;
  private ERR_NOT_AUTHORIZED = 100;
  private ERR_ALREADY_REGISTERED = 101;
  private ERR_INVALID_PARAM = 102;
  private ERR_NOT_OWNER = 103;
  private ERR_NOT_FOUND = 104;
  private ERR_PAUSED = 105;
  private ERR_METADATA_TOO_LONG = 106;
  private ERR_INVALID_SHARE = 107;

  private isOwner(tokenId: number, caller: string): boolean {
    const track = this.state.tracks.get(tokenId);
    return !!track && track.owner === caller;
  }

  private isAdmin(caller: string): boolean {
    return caller === this.state.admin;
  }

  private checkPaused(): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    return { ok: true, value: true };
  }

  transfer(tokenId: number, sender: string, recipient: string): ClarityResponse<boolean> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return pausedCheck;

    if (!this.isOwner(tokenId, sender)) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const track = this.state.tracks.get(tokenId);
    if (!track) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    track.owner = recipient;
    this.state.tracks.set(tokenId, track);
    return { ok: true, value: true };
  }

  getOwner(tokenId: number): ClarityResponse<string | null> {
    const track = this.state.tracks.get(tokenId);
    return { ok: true, value: track ? track.owner : null };
  }

  getLastTokenId(): ClarityResponse<number> {
    return { ok: true, value: this.state.lastTokenId };
  }

  getTokenUri(tokenId: number): ClarityResponse<string | null> {
    const track = this.state.tracks.get(tokenId);
    return { ok: true, value: track ? track.metadata : null };
  }

  mintTrack(metadata: string, title: string, description: string): ClarityResponse<number> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return { ok: false, value: pausedCheck.value };

    if (metadata.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    const newId = this.state.lastTokenId + 1;
    this.state.tracks.set(newId, {
      owner: "caller", // Assuming tx-sender is "caller" in tests
      metadata,
      timestamp: Date.now(),
      title,
      description,
    });
    this.state.lastTokenId = newId;
    return { ok: true, value: newId };
  }

  registerNewVersion(tokenId: number, newMetadata: string, version: number, notes: string): ClarityResponse<boolean> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return pausedCheck;

    if (!this.isOwner(tokenId, "caller")) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (newMetadata.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    const key = `${tokenId}-${version}`;
    this.state.versionRegistry.set(key, {
      updatedMetadata: newMetadata,
      updateNotes: notes,
      timestamp: Date.now(),
    });
    return { ok: true, value: true };
  }

  grantLicense(tokenId: number, licensee: string, duration: number, terms: string): ClarityResponse<boolean> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return pausedCheck;

    if (!this.isOwner(tokenId, "caller")) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${tokenId}-${licensee}`;
    this.state.licenses.set(key, {
      expiry: Date.now() + duration * 1000, // Simulate block-height with time
      terms,
      active: true,
    });
    return { ok: true, value: true };
  }

  addWorkCategory(tokenId: number, category: string, tags: string[]): ClarityResponse<boolean> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return pausedCheck;

    if (!this.isOwner(tokenId, "caller")) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (tags.length > this.MAX_TAGS) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    this.state.workCategories.set(tokenId, { category, tags });
    return { ok: true, value: true };
  }

  addCollaborator(tokenId: number, collaborator: string, role: string, permissions: string[]): ClarityResponse<boolean> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return pausedCheck;

    if (!this.isOwner(tokenId, "caller")) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (permissions.length > this.MAX_PERMISSIONS) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    const key = `${tokenId}-${collaborator}`;
    this.state.collaborators.set(key, {
      role,
      permissions,
      addedAt: Date.now(),
    });
    return { ok: true, value: true };
  }

  updateWorkStatus(tokenId: number, status: string, visibility: boolean): ClarityResponse<boolean> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return pausedCheck;

    if (!this.isOwner(tokenId, "caller")) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.workStatus.set(tokenId, {
      status,
      visibility,
      lastUpdated: Date.now(),
    });
    return { ok: true, value: true };
  }

  setRevenueShare(tokenId: number, participant: string, sharePercentage: number): ClarityResponse<boolean> {
    const pausedCheck = this.checkPaused();
    if (!pausedCheck.ok) return pausedCheck;

    if (!this.isOwner(tokenId, "caller")) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (sharePercentage > 100) {
      return { ok: false, value: this.ERR_INVALID_SHARE };
    }
    const key = `${tokenId}-${participant}`;
    this.state.revenueShares.set(key, {
      percentage: sharePercentage,
      totalReceived: 0,
    });
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  getTrackDetails(tokenId: number): ClarityResponse<TrackRecord | null> {
    return { ok: true, value: this.state.tracks.get(tokenId) ?? null };
  }

  getVersionDetails(tokenId: number, version: number): ClarityResponse<VersionRecord | null> {
    const key = `${tokenId}-${version}`;
    return { ok: true, value: this.state.versionRegistry.get(key) ?? null };
  }

  getLicenseDetails(tokenId: number, licensee: string): ClarityResponse<LicenseRecord | null> {
    const key = `${tokenId}-${licensee}`;
    return { ok: true, value: this.state.licenses.get(key) ?? null };
  }

  getCategory(tokenId: number): ClarityResponse<CategoryRecord | null> {
    return { ok: true, value: this.state.workCategories.get(tokenId) ?? null };
  }

  getCollaborator(tokenId: number, collaborator: string): ClarityResponse<CollaboratorRecord | null> {
    const key = `${tokenId}-${collaborator}`;
    return { ok: true, value: this.state.collaborators.get(key) ?? null };
  }

  getStatus(tokenId: number): ClarityResponse<StatusRecord | null> {
    return { ok: true, value: this.state.workStatus.get(tokenId) ?? null };
  }

  getRevenueShare(tokenId: number, participant: string): ClarityResponse<RevenueShareRecord | null> {
    const key = `${tokenId}-${participant}`;
    return { ok: true, value: this.state.revenueShares.get(key) ?? null };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  artist: "artist",
  user1: "user1",
  user2: "user2",
};

describe("TrackContract Contract", () => {
  let contract: TrackContractMock;

  beforeEach(() => {
    contract = new TrackContractMock();
  });

  it("should mint a new track", () => {
    const mintResult = contract.mintTrack("ipfs://metadata", "Track Title", "Description");
    expect(mintResult).toEqual({ ok: true, value: 1 });

    const details = contract.getTrackDetails(1);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({
        owner: "caller",
        metadata: "ipfs://metadata",
        title: "Track Title",
        description: "Description",
      }),
    });
  });

  it("should prevent minting when paused", () => {
    contract.pauseContract(accounts.deployer);
    const mintResult = contract.mintTrack("ipfs://metadata", "Title", "Desc");
    expect(mintResult).toEqual({ ok: false, value: 105 });
  });

  it("should transfer ownership", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const transferResult = contract.transfer(1, "caller", accounts.user1);
    expect(transferResult).toEqual({ ok: true, value: true });

    const owner = contract.getOwner(1);
    expect(owner).toEqual({ ok: true, value: accounts.user1 });
  });

  it("should prevent transfer by non-owner", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const transferResult = contract.transfer(1, accounts.user1, accounts.user2);
    expect(transferResult).toEqual({ ok: false, value: 103 });
  });

  it("should register new version", () => {
    contract.mintTrack("ipfs://old", "Title", "Desc");
    const versionResult = contract.registerNewVersion(1, "ipfs://new", 2, "Updated mix");
    expect(versionResult).toEqual({ ok: true, value: true });

    const versionDetails = contract.getVersionDetails(1, 2);
    expect(versionDetails).toEqual({
      ok: true,
      value: expect.objectContaining({
        updatedMetadata: "ipfs://new",
        updateNotes: "Updated mix",
      }),
    });
  });

  it("should grant license", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const licenseResult = contract.grantLicense(1, accounts.user1, 100, "Commercial use");
    expect(licenseResult).toEqual({ ok: true, value: true });

    const licenseDetails = contract.getLicenseDetails(1, accounts.user1);
    expect(licenseDetails).toEqual({
      ok: true,
      value: expect.objectContaining({
        terms: "Commercial use",
        active: true,
      }),
    });
  });

  it("should add category and tags", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const categoryResult = contract.addWorkCategory(1, "Electronic", ["dance", "upbeat"]);
    expect(categoryResult).toEqual({ ok: true, value: true });

    const category = contract.getCategory(1);
    expect(category).toEqual({
      ok: true,
      value: { category: "Electronic", tags: ["dance", "upbeat"] },
    });
  });

  it("should add collaborator", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const collabResult = contract.addCollaborator(1, accounts.user2, "Producer", ["edit", "share"]);
    expect(collabResult).toEqual({ ok: true, value: true });

    const collab = contract.getCollaborator(1, accounts.user2);
    expect(collab).toEqual({
      ok: true,
      value: expect.objectContaining({
        role: "Producer",
        permissions: ["edit", "share"],
      }),
    });
  });

  it("should update status", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const statusResult = contract.updateWorkStatus(1, "Published", true);
    expect(statusResult).toEqual({ ok: true, value: true });

    const status = contract.getStatus(1);
    expect(status).toEqual({
      ok: true,
      value: expect.objectContaining({
        status: "Published",
        visibility: true,
      }),
    });
  });

  it("should set revenue share", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const shareResult = contract.setRevenueShare(1, accounts.user2, 30);
    expect(shareResult).toEqual({ ok: true, value: true });

    const share = contract.getRevenueShare(1, accounts.user2);
    expect(share).toEqual({
      ok: true,
      value: { percentage: 30, totalReceived: 0 },
    });
  });

  it("should prevent invalid revenue share", () => {
    contract.mintTrack("ipfs://metadata", "Title", "Desc");
    const shareResult = contract.setRevenueShare(1, accounts.user2, 101);
    expect(shareResult).toEqual({ ok: false, value: 107 });
  });

  it("should pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-admin from pausing", () => {
    const pauseResult = contract.pauseContract(accounts.user1);
    expect(pauseResult).toEqual({ ok: false, value: 100 });
  });
});