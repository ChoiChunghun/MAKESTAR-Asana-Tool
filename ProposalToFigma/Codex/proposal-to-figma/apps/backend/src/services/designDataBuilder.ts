import type { DesignData, DesignOutput, ProposalData } from "../types";
import { buildSourceHash } from "../utils/hash";

const parseCache = new Map<string, DesignData>();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function buildArtistAlbumTitle(proposal: ProposalData): string {
  return [proposal.artistName, proposal.albumName].filter(Boolean).join(" ").trim();
}

function buildSiteText(proposal: ProposalData): string {
  if (proposal.channels.weidian) {
    return "WEIDIAN";
  }
  if (proposal.channels.makestar) {
    return "MAKESTAR";
  }
  if (proposal.channels.x && proposal.channels.instagram) {
    return "X / INSTAGRAM";
  }
  if (proposal.channels.x) {
    return "X";
  }
  if (proposal.channels.instagram) {
    return "INSTAGRAM";
  }
  return "";
}

export function buildDesignData(proposal: ProposalData): DesignData {
  const sourceHash = buildSourceHash(proposal.rawRows);
  const benefitCountForStory = clamp(proposal.benefits.length || 1, 1, 9);
  const benefitCountForOpen01 = proposal.benefits.length > 0 ? String(clamp(proposal.benefits.length, 1, 4)) : "Null";
  const periodText =
    proposal.schedule.salesPeriod ||
    proposal.schedule.applyPeriod ||
    proposal.schedule.eventDate ||
    "";

  const sharedFlags = proposal.reviewFlags;

  const bannerOutput: DesignOutput = {
    outputId: `${proposal.productCode}_BANNER`,
    outputType: "BANNER",
    templateLabel: "MAKESTAR-WEIDIAN / Banner",
    templateInstanceName: "Banner",
    componentProps: {
      Photo: proposal.channels.weidian ? "Wedian" : "Mobile"
    },
    textBindings: {},
    imageBindings: {},
    colorBindings: {},
    sourceRefs: unique(proposal.sourceMap.basicInfo),
    reviewFlags: unique(sharedFlags)
  };

  const storyOutput: DesignOutput = {
    outputId: `${proposal.productCode}_STORY`,
    outputType: "STORY",
    templateLabel: "MAKESTAR-WEIDIAN / Story",
    templateInstanceName: "Story",
    componentProps: {
      Item: String(benefitCountForStory),
      Background: proposal.benefits.length >= 2 ? "On" : "Off"
    },
    textBindings: {},
    imageBindings: {},
    colorBindings: {},
    sourceRefs: unique(proposal.benefits.map((benefit) => benefit.sourceRef)),
    reviewFlags: unique([
      ...sharedFlags,
      ...(proposal.benefits.length > 9 ? ["BENEFIT_COUNT_EXCEEDED_STORY_LIMIT" as const] : [])
    ])
  };

  const open01Output: DesignOutput = {
    outputId: `${proposal.productCode}_SNS_X_OPEN_01`,
    outputType: "SNS_X_OPEN_01",
    templateLabel: "Template SNS / X / OPEN / 01",
    templateInstanceName: "OPEN / 01",
    componentProps: {
      Gradient: "Null",
      TxtColor: "Black",
      Tag: proposal.designHints.hasEventHashtag ? "On" : "Off",
      Site: proposal.designHints.hasSiteInfo ? "On" : "Off",
      Benefit: benefitCountForOpen01
    },
    textBindings: {
      artistAlbumTitle: buildArtistAlbumTitle(proposal),
      eventTitle: proposal.eventTitle,
      periodText,
      siteText: buildSiteText(proposal)
    },
    imageBindings: {},
    colorBindings: {},
    sourceRefs: unique([
      ...proposal.sourceMap.basicInfo,
      ...proposal.sourceMap.schedule,
      ...proposal.benefits.slice(0, 4).map((benefit) => benefit.sourceRef)
    ]),
    reviewFlags: unique([
      ...sharedFlags,
      ...(proposal.benefits.length > 4 ? ["BENEFIT_COUNT_EXCEEDED_OPEN01_LIMIT" as const] : [])
    ])
  };

  const designData: DesignData = {
    designId: `${proposal.productCode}_${sourceHash.slice(0, 8)}`,
    sourceSpreadsheetId: proposal.sourceSpreadsheetId,
    sourceSheetName: proposal.sourceSheetName,
    sourceRange: proposal.sourceRange,
    sourceHash,
    proposal,
    outputs: [bannerOutput, storyOutput, open01Output]
  };

  cacheDesignData(designData);
  return designData;
}

export function cacheDesignData(designData: DesignData): void {
  parseCache.set(designData.sourceHash, designData);
}

export function getCachedDesignData(sourceHash: string): DesignData | undefined {
  return parseCache.get(sourceHash);
}

export function findOutputById(designData: DesignData, outputId: string): DesignOutput {
  const output = designData.outputs.find((candidate) => candidate.outputId === outputId);
  if (!output) {
    throw new Error(`출력을 찾지 못했습니다: ${outputId}`);
  }
  return output;
}

export function diffOutputs(previousOutput: DesignOutput | undefined, currentOutput: DesignOutput): string[] {
  if (!previousOutput) {
    return ["sourceHash", "componentProps", "textBindings"];
  }

  const changedFields: string[] = [];
  const keys = unique([
    ...Object.keys(previousOutput.componentProps),
    ...Object.keys(currentOutput.componentProps)
  ]);

  for (const key of keys) {
    if (previousOutput.componentProps[key] !== currentOutput.componentProps[key]) {
      changedFields.push(`componentProps.${key}`);
    }
  }

  const textKeys = unique([...Object.keys(previousOutput.textBindings), ...Object.keys(currentOutput.textBindings)]);
  for (const key of textKeys) {
    if (previousOutput.textBindings[key] !== currentOutput.textBindings[key]) {
      changedFields.push(`textBindings.${key}`);
    }
  }

  if (JSON.stringify(previousOutput.reviewFlags) !== JSON.stringify(currentOutput.reviewFlags)) {
    changedFields.push("reviewFlags");
  }

  return changedFields.length ? changedFields : ["sourceHash"];
}

