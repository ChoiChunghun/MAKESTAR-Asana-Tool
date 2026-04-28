import { errorMessage } from "./logger";
import { isSupportedImageNode } from "./selection";

export async function applyImageFill(node: SceneNode, imageUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isSupportedImageNode(node)) {
      return { ok: false, error: `Unsupported node type: ${node.type}` };
    }

    if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
      return { ok: false, error: `Invalid image URL: ${imageUrl || "(empty)"}` };
    }

    const image = await figma.createImageAsync(imageUrl);
    const paint: ImagePaint = {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: "FILL"
    };

    (node as RectangleNode | FrameNode).fills = [paint];
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
