import { buildBinding, writeBinding } from "./bindingStorage";
import { applyComponentProps } from "./componentProps";
import { findTemplateInstance } from "./figmaTemplateFinder";
import { applyTextBindings } from "./textBinding";
import type { DesignData } from "../shared/types";

function layoutPosition(index: number, node: SceneNode): { x: number; y: number } {
  const startX = figma.viewport.center.x - 200;
  const startY = figma.viewport.center.y - 200;
  const gap = 80;

  return {
    x: startX + index * (node.width + gap),
    y: startY
  };
}

export async function generateOutputs(
  designData: DesignData,
  outputIds: string[]
): Promise<Array<{ outputId: string; nodeId: string; nodeName: string }>> {
  const outputs = designData.outputs.filter((output) => outputIds.includes(output.outputId));
  const created: Array<{ outputId: string; nodeId: string; nodeName: string }> = [];
  const selectedNodes: SceneNode[] = [];

  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index];
    if (!output) {
      continue;
    }
    const templateInstance = findTemplateInstance(output.outputType);
    const clone = templateInstance.clone();

    figma.currentPage.appendChild(clone);
    const position = layoutPosition(index, clone);
    clone.x = position.x;
    clone.y = position.y;
    clone.name = `[AUTO] ${designData.proposal.productCode} / ${output.outputType}`;

    applyComponentProps(clone, output.componentProps);
    await applyTextBindings(clone, output);

    const binding = buildBinding(designData, output);
    writeBinding(clone, binding);

    created.push({
      outputId: output.outputId,
      nodeId: clone.id,
      nodeName: clone.name
    });
    selectedNodes.push(clone);
  }

  if (selectedNodes.length) {
    figma.currentPage.selection = selectedNodes;
    figma.viewport.scrollAndZoomIntoView(selectedNodes);
  }

  return created;
}
