import type { DesignData, DesignOutput, FigmaBinding } from "../shared/types";

const BINDING_KEY = "proposalToFigmaBinding";

export function buildBinding(designData: DesignData, output: DesignOutput, previousBinding?: FigmaBinding): FigmaBinding {
  const now = new Date().toISOString();

  return {
    version: 1,
    sourceSpreadsheetId: designData.sourceSpreadsheetId,
    sourceSheetName: designData.sourceSheetName,
    sourceRange: designData.sourceRange,
    sourceHash: designData.sourceHash,
    outputType: output.outputType,
    outputId: output.outputId,
    productCode: designData.proposal.productCode,
    sourceRefs: output.sourceRefs,
    textBindings: output.textBindings,
    componentProps: output.componentProps,
    createdAt: previousBinding?.createdAt ?? now,
    lastSyncedAt: now,
    manualOverrideLayers: previousBinding?.manualOverrideLayers ?? []
  };
}

export function writeBinding(node: BaseNodeMixin, binding: FigmaBinding): void {
  node.setPluginData(BINDING_KEY, JSON.stringify(binding));
}

export function readBinding(node: BaseNodeMixin): FigmaBinding | null {
  const raw = node.getPluginData(BINDING_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as FigmaBinding;
  } catch {
    return null;
  }
}

export function getBindingKey(): string {
  return BINDING_KEY;
}

