import { Document, Node, Scene, Mesh, Material, Texture } from '@gltf-transform/core'

/**
 * gltf-transform 기반 모델 구조 분석 및 Scene Graph 조작 유틸리티
 */

export interface GLTFNodeInfo {
  id: string
  name: string
  type: 'asset' | 'scenes' | 'nodes' | 'meshes' | 'materials' | 'textures' | 'images' | 'buffers' | 'bufferViews' | 'accessors' | 'skins' | 'animations' | 'extensions'
  children: GLTFNodeInfo[]
  properties: Record<string, any>
  count: number
  depth: number
  uuid: string
}

/**
 * Document에서 glTF 구조를 추출 (JSON 필드 기준)
 */
export function extractSceneGraph(document: Document): GLTFNodeInfo[] {
  const root = document.getRoot()
  const structure: GLTFNodeInfo[] = []

  // asset 정보
  structure.push({
    id: 'asset',
    name: 'Asset',
    type: 'asset',
    children: [],
    properties: {
      version: '2.0',
      generator: root.getAsset().generator || 'unknown',
      copyright: root.getAsset().copyright || null,
      minVersion: root.getAsset().minVersion || null
    },
    count: 1,
    depth: 0,
    uuid: 'asset'
  })

  // scenes
  const scenes = root.listScenes()
  if (scenes.length > 0) {
    structure.push({
      id: 'scenes',
      name: `Scenes`,
      type: 'scenes',
      children: scenes.map((scene, index) => ({
        id: `scene_${index}`,
        name: scene.getName() || `Scene ${index}`,
        type: 'scenes',
        children: [],
        properties: {
          nodeCount: scene.listChildren().length,
          extras: scene.getExtras()
        },
        count: scene.listChildren().length,
        depth: 1,
        uuid: `scene_${index}`
      })),
      properties: {
        defaultScene: 0
      },
      count: scenes.length,
      depth: 0,
      uuid: 'scenes'
    })
  }

  // nodes
  const nodes = root.listNodes()
  if (nodes.length > 0) {
    structure.push({
      id: 'nodes',
      name: `Nodes`,
      type: 'nodes',
      children: nodes.map((node, index) => ({
        id: `node_${index}`,
        name: node.getName() || `Node ${index}`,
        type: 'nodes',
        children: [],
        properties: {
          translation: node.getTranslation(),
          rotation: node.getRotation(),
          scale: node.getScale(),
          mesh: node.getMesh() ? nodes.indexOf(node.getMesh()!) : null,
          camera: node.getCamera() ? 'camera_ref' : null,
          skin: node.getSkin() ? 'skin_ref' : null,
          children: node.listChildren().map(child => nodes.indexOf(child)),
          extras: node.getExtras()
        },
        count: node.listChildren().length,
        depth: 1,
        uuid: `node_${index}`
      })),
      properties: {},
      count: nodes.length,
      depth: 0,
      uuid: 'nodes'
    })
  }

  // meshes
  const meshes = root.listMeshes()
  if (meshes.length > 0) {
    structure.push({
      id: 'meshes',
      name: `Meshes`,
      type: 'meshes',
      children: meshes.map((mesh, index) => ({
        id: `mesh_${index}`,
        name: mesh.getName() || `Mesh ${index}`,
        type: 'meshes',
        children: [],
        properties: {
          primitiveCount: mesh.listPrimitives().length,
          extras: mesh.getExtras()
        },
        count: mesh.listPrimitives().length,
        depth: 1,
        uuid: `mesh_${index}`
      })),
      properties: {},
      count: meshes.length,
      depth: 0,
      uuid: 'meshes'
    })
  }

  // materials
  const materials = root.listMaterials()
  if (materials.length > 0) {
    structure.push({
      id: 'materials',
      name: `Materials`,
      type: 'materials',
      children: materials.map((material, index) => ({
        id: `material_${index}`,
        name: material.getName() || `Material ${index}`,
        type: 'materials',
        children: [],
        properties: {
          baseColorFactor: material.getBaseColorFactor(),
          metallicFactor: material.getMetallicFactor(),
          roughnessFactor: material.getRoughnessFactor(),
          alphaMode: material.getAlphaMode(),
          doubleSided: material.getDoubleSided(),
          extras: material.getExtras()
        },
        count: 1,
        depth: 1,
        uuid: `material_${index}`
      })),
      properties: {},
      count: materials.length,
      depth: 0,
      uuid: 'materials'
    })
  }

  // textures
  const textures = root.listTextures()
  if (textures.length > 0) {
    structure.push({
      id: 'textures',
      name: `Textures`,
      type: 'textures',
      children: textures.map((texture, index) => ({
        id: `texture_${index}`,
        name: texture.getName() || `Texture ${index}`,
        type: 'textures',
        children: [],
        properties: {
          mimeType: texture.getMimeType(),
          size: texture.getSize(),
          extras: texture.getExtras()
        },
        count: 1,
        depth: 1,
        uuid: `texture_${index}`
      })),
      properties: {},
      count: textures.length,
      depth: 0,
      uuid: 'textures'
    })
  }

  // animations
  const animations = root.listAnimations()
  if (animations.length > 0) {
    structure.push({
      id: 'animations',
      name: `Animations`,
      type: 'animations',
      children: animations.map((animation, index) => ({
        id: `animation_${index}`,
        name: animation.getName() || `Animation ${index}`,
        type: 'animations',
        children: [],
        properties: {
          channelCount: animation.listChannels().length,
          samplerCount: animation.listSamplers().length,
          extras: animation.getExtras()
        },
        count: animation.listChannels().length,
        depth: 1,
        uuid: `animation_${index}`
      })),
      properties: {},
      count: animations.length,
      depth: 0,
      uuid: 'animations'
    })
  }

  // skins
  const skins = root.listSkins()
  if (skins.length > 0) {
    structure.push({
      id: 'skins',
      name: `Skins`,
      type: 'skins',
      children: skins.map((skin, index) => ({
        id: `skin_${index}`,
        name: skin.getName() || `Skin ${index}`,
        type: 'skins',
        children: [],
        properties: {
          jointCount: skin.listJoints().length,
          skeleton: skin.getSkeleton() ? 'skeleton_ref' : null,
          extras: skin.getExtras()
        },
        count: skin.listJoints().length,
        depth: 1,
        uuid: `skin_${index}`
      })),
      properties: {},
      count: skins.length,
      depth: 0,
      uuid: 'skins'
    })
  }

  // extensions
  const extensionsUsed = root.listExtensionsUsed()
  if (extensionsUsed.length > 0) {
    structure.push({
      id: 'extensions',
      name: `Extensions`,
      type: 'extensions',
      children: extensionsUsed.map((ext, index) => ({
        id: `extension_${index}`,
        name: ext.extensionName,
        type: 'extensions',
        children: [],
        properties: {
          required: root.listExtensionsRequired().includes(ext)
        },
        count: 1,
        depth: 1,
        uuid: `extension_${index}`
      })),
      properties: {},
      count: extensionsUsed.length,
      depth: 0,
      uuid: 'extensions'
    })
  }

  return structure
}

/**
 * Document에서 모든 리소스 정보 추출 (간단한 카운트)
 */
export function extractResourceInfo(document: Document) {
  const root = document.getRoot()
  
  return {
    scenes: root.listScenes().length,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    animations: root.listAnimations().length,
    skins: root.listSkins().length,
    extensions: root.listExtensionsUsed().length
  }
}

/**
 * Document에서 실제 Scene Graph 계층 구조를 추출
 */
export function extractSceneGraphHierarchy(document: Document): GLTFNodeInfo[] {
  const root = document.getRoot()
  const scenes = root.listScenes()
  
  return scenes.map((scene, sceneIndex) => buildSceneHierarchy(scene, sceneIndex))
}

/**
 * Scene을 실제 계층 구조로 변환
 */
function buildSceneHierarchy(scene: Scene, sceneIndex: number): GLTFNodeInfo {
  const sceneInfo: GLTFNodeInfo = {
    id: `scene_${sceneIndex}`,
    name: scene.getName() || `Scene ${sceneIndex}`,
    type: 'scenes',
    children: [],
    properties: {
      nodeCount: scene.listChildren().length,
      extras: scene.getExtras()
    },
    count: scene.listChildren().length,
    depth: 0,
    uuid: `scene_${sceneIndex}`
  }

  // Scene의 직접 자식 노드들을 계층적으로 처리
  scene.listChildren().forEach((node, nodeIndex) => {
    sceneInfo.children.push(buildNodeHierarchy(node, `scene_${sceneIndex}_node_${nodeIndex}`, 1))
  })

  return sceneInfo
}

/**
 * Node를 실제 계층 구조로 변환 (재귀적)
 */
function buildNodeHierarchy(node: Node, nodeId: string, depth: number): GLTFNodeInfo {
  const nodeInfo: GLTFNodeInfo = {
    id: nodeId,
    name: node.getName() || 'Unnamed Node',
    type: 'nodes',
    children: [],
    properties: {
      translation: node.getTranslation(),
      rotation: node.getRotation(),
      scale: node.getScale(),
      matrix: node.getMatrix(),
      mesh: node.getMesh()?.getName() || null,
      camera: node.getCamera()?.getName() || null,
      skin: node.getSkin()?.getName() || null,
      extras: node.getExtras()
    },
    count: node.listChildren().length,
    depth,
    uuid: nodeId
  }

  // 자식 노드들을 재귀적으로 처리
  node.listChildren().forEach((childNode, childIndex) => {
    nodeInfo.children.push(buildNodeHierarchy(childNode, `${nodeId}_${childIndex}`, depth + 1))
  })

  return nodeInfo
}

/**
 * 노드 검색 기능
 */
export function searchNodes(document: Document, query: string): GLTFNodeInfo[] {
  const allNodes = extractAllNodesFromHierarchy(document)
  const searchQuery = query.toLowerCase()
  
  return allNodes.filter(node => 
    node.name.toLowerCase().includes(searchQuery) ||
    node.type.toLowerCase().includes(searchQuery)
  )
}

/**
 * Scene Graph 계층구조에서 모든 노드를 플랫 리스트로 추출
 */
function extractAllNodesFromHierarchy(document: Document): GLTFNodeInfo[] {
  const result: GLTFNodeInfo[] = []
  const sceneGraphs = extractSceneGraphHierarchy(document)
  
  function flattenNodes(nodeInfo: GLTFNodeInfo) {
    result.push(nodeInfo)
    nodeInfo.children.forEach(child => flattenNodes(child))
  }
  
  sceneGraphs.forEach(scene => flattenNodes(scene))
  return result
}

// 기존 copyNode 함수는 copyNodeInDocument로 대체됨

/**
 * 노드 삭제 (실제 Document에서)
 */
export function removeNodeFromDocument(document: Document, nodeId: string): boolean {
  try {
    const node = findNodeByIdInDocument(document, nodeId)
    if (!node) {
      console.warn(`Node with ID ${nodeId} not found`)
      return false
    }
    
    const root = document.getRoot()
    
    // Scene에서 직접 자식으로 있는지 확인
    root.listScenes().forEach(scene => {
      const children = scene.listChildren()
      if (children.includes(node)) {
        scene.removeChild(node)
        console.log(`Removed node ${nodeId} from scene ${scene.getName()}`)
      }
    })
    
    // 다른 Node의 자식으로 있는지 확인
    root.listNodes().forEach(parentNode => {
      const children = parentNode.listChildren()
      if (children.includes(node)) {
        parentNode.removeChild(node)
        console.log(`Removed node ${nodeId} from parent ${parentNode.getName()}`)
      }
    })
    
    // Document에서 완전 제거
    node.dispose()
    console.log(`Node ${nodeId} disposed from document`)
    return true
  } catch (error) {
    console.error(`Failed to remove node ${nodeId}:`, error)
    return false
  }
}

/**
 * 노드 이동 (실제 Document에서)
 */
export function moveNodeInDocument(document: Document, sourceNodeId: string, targetParentId: string): boolean {
  try {
    const sourceNode = findNodeByIdInDocument(document, sourceNodeId)
    if (!sourceNode) {
      console.warn(`Source node ${sourceNodeId} not found`)
      return false
    }
    
    // 타겟이 Scene인지 Node인지 확인
    const targetParent = findNodeByIdInDocument(document, targetParentId) || findSceneByIdInDocument(document, targetParentId)
    if (!targetParent) {
      console.warn(`Target parent ${targetParentId} not found`)
      return false
    }
    
    const root = document.getRoot()
    
    // 현재 부모에서 제거
    root.listScenes().forEach(scene => {
      const children = scene.listChildren()
      if (children.includes(sourceNode)) {
        scene.removeChild(sourceNode)
        console.log(`Removed from scene ${scene.getName()}`)
      }
    })
    
    root.listNodes().forEach(parentNode => {
      const children = parentNode.listChildren()
      if (children.includes(sourceNode)) {
        parentNode.removeChild(sourceNode)
        console.log(`Removed from parent ${parentNode.getName()}`)
      }
    })
    
    // 새 부모에 추가
    if (targetParent instanceof Node) {
      targetParent.addChild(sourceNode)
      console.log(`Added to node ${targetParent.getName()}`)
    } else if (targetParent instanceof Scene) {
      targetParent.addChild(sourceNode)
      console.log(`Added to scene ${targetParent.getName()}`)
    }
    
    return true
  } catch (error) {
    console.error(`Failed to move node ${sourceNodeId} to ${targetParentId}:`, error)
    return false
  }
}

/**
 * 노드 복사 (실제 Document에서)
 */
export function copyNodeInDocument(document: Document, sourceNodeId: string, targetParentId: string): boolean {
  try {
    const sourceNode = findNodeByIdInDocument(document, sourceNodeId)
    if (!sourceNode) {
      console.warn(`Source node ${sourceNodeId} not found`)
      return false
    }
    
    const targetParent = findNodeByIdInDocument(document, targetParentId) || findSceneByIdInDocument(document, targetParentId)
    if (!targetParent) {
      console.warn(`Target parent ${targetParentId} not found`)
      return false
    }
    
    // 노드 복사
    const copiedNode = cloneNodeRecursive(document, sourceNode)
    
    // 새 부모에 추가
    if (targetParent instanceof Node) {
      targetParent.addChild(copiedNode)
      console.log(`Copied node to ${targetParent.getName()}`)
    } else if (targetParent instanceof Scene) {
      targetParent.addChild(copiedNode)
      console.log(`Copied node to scene ${targetParent.getName()}`)
    }
    
    return true
  } catch (error) {
    console.error(`Failed to copy node ${sourceNodeId} to ${targetParentId}:`, error)
    return false
  }
}

/**
 * 노드를 재귀적으로 복사 (깊은 복사)
 */
function cloneNodeRecursive(document: Document, sourceNode: Node): Node {
  const newNode = document.createNode()
    .setName(`${sourceNode.getName()}_copy`)
    .setTranslation(sourceNode.getTranslation())
    .setRotation(sourceNode.getRotation())
    .setScale(sourceNode.getScale())
  
  // 메시 복사 (참조 공유)
  if (sourceNode.getMesh()) {
    newNode.setMesh(sourceNode.getMesh())
  }
  
  // 카메라 복사 (참조 공유)
  if (sourceNode.getCamera()) {
    newNode.setCamera(sourceNode.getCamera())
  }
  
  // 스킨 복사 (참조 공유)
  if (sourceNode.getSkin()) {
    newNode.setSkin(sourceNode.getSkin())
  }
  
  // 자식 노드들 재귀 복사
  sourceNode.listChildren().forEach(child => {
    const copiedChild = cloneNodeRecursive(document, child)
    newNode.addChild(copiedChild)
  })
  
  return newNode
}
/**
 * 헬퍼 함수들
 */
function findNodeByIdInDocument(document: Document, nodeId: string): Node | null {
  const root = document.getRoot()
  const allNodes = root.listNodes()
  
  // nodeId에서 실제 노드 인덱스 추출
  if (nodeId.includes('_node_')) {
    // scene_0_node_1_2 형태에서 마지막 숫자들을 파싱
    const parts = nodeId.split('_')
    const nodeIndices: number[] = []
    
    // '_node_' 이후의 모든 숫자를 수집
    let foundNodeKeyword = false
    for (const part of parts) {
      if (foundNodeKeyword && !isNaN(parseInt(part))) {
        nodeIndices.push(parseInt(part))
      }
      if (part === 'node') {
        foundNodeKeyword = true
      }
    }
    
    if (nodeIndices.length === 0) return null
    
    // 첫 번째 인덱스로 루트 노드 찾기
    let currentNode = allNodes[nodeIndices[0]]
    if (!currentNode) return null
    
    // 나머지 인덱스들로 자식들 탐색
    for (let i = 1; i < nodeIndices.length; i++) {
      const children = currentNode.listChildren()
      currentNode = children[nodeIndices[i]]
      if (!currentNode) return null
    }
    
    return currentNode
  }
  
  return null
}

function findSceneByIdInDocument(document: Document, sceneId: string): Scene | null {
  const root = document.getRoot()
  const scenes = root.listScenes()
  
  // sceneId 파싱 (예: "scene_0")
  const parts = sceneId.split('_')
  if (parts.length >= 2 && parts[0] === 'scene') {
    try {
      const sceneIndex = parseInt(parts[1])
      return scenes[sceneIndex] || null
    } catch {
      return null
    }
  }
  
  return null
}

function getNodeId(document: Document, node: Node): string {
  // 현재는 사용하지 않음 - 계층구조 ID 사용
  return 'node_unknown'
}

/**
 * 노드 통계 정보 계산
 */
export function calculateNodeStats(nodeInfo: GLTFNodeInfo): {
  totalItems: number
  maxDepth: number
  leafNodes: number
} {
  let totalItems = 1
  let maxDepth = nodeInfo.depth
  let leafNodes = nodeInfo.children.length === 0 ? 1 : 0
  
  function traverse(node: GLTFNodeInfo) {
    totalItems++
    maxDepth = Math.max(maxDepth, node.depth)
    
    if (node.children.length === 0) {
      leafNodes++
    } else {
      node.children.forEach(child => traverse(child))
    }
  }
  
  nodeInfo.children.forEach(child => traverse(child))
  
  return { totalItems, maxDepth, leafNodes }
}