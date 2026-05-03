import { buildBinding, readBinding, writeBinding } from "./bindingStorage";
import { applyComponentProps } from "./componentProps";
import { applyTextBindings } from "./textBinding";
import type { DesignData, DesignOutput, FigmaBinding } from "../shared/types";

function getSingleSelectedNode(): SceneNode {
  const [selectedNode] = figma.currentPage.selection;
  if (!selectedNode) {
    throw new Error("업데이트할 AUTO 프레임 또는 인스턴스를 먼저 선택해 주세요.");
  }
  return selectedNode;
}

function assertUpdatableInstance(node: SceneNode): InstanceNode {
  if (node.type !== "INSTANCE") {
    throw new Error("현재 MVP에서는 생성된 최상위 Instance만 업데이트할 수 있습니다.");
  }
  return node;
}

export function readSelectedBinding(): { node: SceneNode; binding: FigmaBinding | null } {
  const node = getSingleSelectedNode();
  return {
    node,
    binding: readBinding(node)
  };
}

export async function applyOutputToSelection(designData: DesignData, output: DesignOutput): Promise<SceneNode> {
  const selectedNode = getSingleSelectedNode();
  const instance = assertUpdatableInstance(selectedNode);
  const previousBinding = readBinding(instance);

  applyComponentProps(instance, output.componentProps);
  await applyTextBindings(instance, output);

  const binding = buildBinding(designData, output, previousBinding ?? undefined);
  writeBinding(instance, binding);
  instance.name = `[AUTO] ${designData.proposal.productCode} / ${output.outputType}`;

  return instance;
}

