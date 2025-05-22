// lib/model-loaders.ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { VRMLoaderPlugin } from "@pixiv/three-vrm"
import { GLTFDocumentManager } from "@/lib/gltf-document-manager"

export async function loadThreeGLTF(file: File, modelUrl: string): Promise<any> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  return await new Promise<any>((resolve, reject) => {
    loader.load(modelUrl, resolve, undefined, reject)
  })
}

export async function loadGLTFDocument(file: File): Promise<GLTFDocumentManager | null> {
  try {
    const manager = new GLTFDocumentManager()
    await manager.loadFromFile(file)

    const root = manager.getDocument().getRoot()
    const vrmExt = root.getExtension("VRMC_vrm")
    const vrmMetaExt = root.getExtension("VRMC_vrm_meta")
    if (vrmExt || vrmMetaExt) {
      root.setExtras({
        ...root.getExtras(),
        vrm: vrmExt || null,
        vrmMetadata: vrmMetaExt || null,
      })
      console.log("🟢 [LOAD] VRM 확장 정보를 extras에 반영 완료:", root.getExtras())
    }

    console.log("📦 extensionsUsed (raw):", root.listExtensionsUsed().map(e => e.extensionName))
    return manager
  } catch (e) {
    console.warn("🔴 [LOAD] GLTFDocumentManager Document 로드 실패:", e)
    return null
  }
}