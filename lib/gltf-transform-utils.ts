import { Document, Node, Scene, Mesh, Material, Texture, Accessor, Buffer } from '@gltf-transform/core'

// TypedArray 타입 정의
type TypedArray = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int32Array | Int16Array | Int8Array

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
          extras: node.getExtras(),
          extensions: node.getExtras()?.originalExtensions || {},
          hasExtensions: !!(node.getExtras()?.originalExtensions && Object.keys(node.getExtras().originalExtensions).length > 0)
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
        children: animation.listChannels().map((channel, channelIndex) => ({
          id: `animation_${index}_channel_${channelIndex}`,
          name: `Channel ${channelIndex}`,
          type: 'animations',
          children: [],
          properties: {
            target: channel.getTargetNode()?.getName() || 'Unknown',
            path: channel.getTargetPath(),
            sampler: channel.getSampler()?.getName() || `Sampler ${channelIndex}`,
            interpolation: channel.getSampler()?.getInterpolation() || 'LINEAR'
          },
          count: 1,
          depth: 2,
          uuid: `animation_${index}_channel_${channelIndex}`
        })),
        properties: {
          channelCount: animation.listChannels().length,
          samplerCount: animation.listSamplers().length,
          duration: calculateAnimationDuration(animation),
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

  // extensions - 모든 확장 정보 수집
  const extensionsUsed = root.listExtensionsUsed()
  const extensionsRequired = root.listExtensionsRequired()
  const rootExtras = root.getExtras()
  const extensionsData: GLTFNodeInfo[] = []
  const collectedExtensions = new Set<string>()
  
  // 1. 선언된 extensions 처리
  extensionsUsed.forEach((ext, index) => {
    const extName = ext.extensionName
    const extInstance = root.getExtension(extName)
    collectedExtensions.add(extName)
    
    extensionsData.push({
      id: `extension_${index}`,
      name: extName,
      type: 'extensions',
      children: [],
      properties: {
        required: extensionsRequired.some(req => req.extensionName === extName),
        active: !!extInstance,
        data: extInstance || null,
        preserved: false,
        source: 'declared'
      },
      count: 1,
      depth: 1,
      uuid: `extension_${index}`
    })
  })
  
  // 2. 보존된 originalExtensions 처리
  if (rootExtras?.originalExtensions) {
    Object.keys(rootExtras.originalExtensions).forEach((extName) => {
      if (!collectedExtensions.has(extName)) {
        const index = extensionsData.length
        collectedExtensions.add(extName)
        
        extensionsData.push({
          id: `preserved_extension_${index}`,
          name: `${extName} (preserved)`,
          type: 'extensions',
          children: [],
          properties: {
            required: false,
            active: false,
            data: rootExtras.originalExtensions[extName],
            preserved: true,
            source: 'preserved'
          },
          count: 1,
          depth: 1,
          uuid: `preserved_extension_${index}`
        })
      }
    })
  }
  
  // 3. 노드별 extensions 검사
  root.listNodes().forEach((node, nodeIndex) => {
    const nodeExtras = node.getExtras()
    if (nodeExtras?.originalExtensions) {
      Object.keys(nodeExtras.originalExtensions).forEach((extName) => {
        if (!collectedExtensions.has(extName)) {
          const index = extensionsData.length
          collectedExtensions.add(extName)
          
          extensionsData.push({
            id: `node_extension_${nodeIndex}_${index}`,
            name: `${extName} (node-${nodeIndex})`,
            type: 'extensions',
            children: [],
            properties: {
              required: false,
              active: false,
              data: nodeExtras.originalExtensions[extName],
              preserved: true,
              source: 'node',
              nodeIndex
            },
            count: 1,
            depth: 1,
            uuid: `node_extension_${nodeIndex}_${index}`
          })
        }
      })
    }
  })
  
  // Extensions 섹션 추가
  if (extensionsData.length > 0) {
    structure.push({
      id: 'extensions',
      name: `Extensions`,
      type: 'extensions',
      children: extensionsData,
      properties: {
        total: extensionsData.length,
        declared: extensionsUsed.length,
        preserved: rootExtras?.originalExtensions ? Object.keys(rootExtras.originalExtensions).length : 0,
        required: extensionsRequired.length
      },
      count: extensionsData.length,
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
      extras: node.getExtras(),
      extensions: node.getExtras()?.originalExtensions || {},
      hasExtensions: !!(node.getExtras()?.originalExtensions && Object.keys(node.getExtras().originalExtensions).length > 0)
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
 * 노드 복사 (실제 Document에서) - DEPRECATED
 */
function copyNodeInDocument(document: Document, sourceNodeId: string, targetParentId: string): boolean {
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

/**
 * 애니메이션 지속 시간 계산
 */
function calculateAnimationDuration(animation: any): number {
  let maxTime = 0;
  
  try {
    animation.listSamplers().forEach((sampler: any) => {
      const input = sampler.getInput();
      if (input && input.getArray) {
        const times = input.getArray();
        if (times && times.length > 0) {
          const lastTime = times[times.length - 1];
          maxTime = Math.max(maxTime, lastTime);
        }
      }
    });
  } catch (error) {
    console.warn('애니메이션 지속 시간 계산 실패:', error);
  }
  
  return maxTime;
}

/**
 * Document에 새 애니메이션 추가
 */
export function addAnimationToDocument(document: Document, animationClip: any): boolean {
  try {
    console.log('Document에 애니메이션 추가 시작:', animationClip.name);
    console.log('애니메이션 클립 정보:', {
      name: animationClip.name,
      duration: animationClip.duration,
      tracks: animationClip.tracks.length
    });
    
    const root = document.getRoot();
    
    // Three.js AnimationClip을 gltf-transform Animation으로 변환
    const gltfAnimation = document.createAnimation()
      .setName(animationClip.name || 'New Animation');
    
    // 기존 버퍼 또는 새 버퍼 생성
    let buffer = root.listBuffers()[0];
    if (!buffer) {
      buffer = document.createBuffer();
    }
    
    console.log(`처리할 트랙 수: ${animationClip.tracks.length}`);
    let validTrackCount = 0;
    
    // 트랙들을 채널과 샘플러로 변환
    animationClip.tracks.forEach((track: any, trackIndex: number) => {
      try {
        console.log(`트랙 ${trackIndex} 처리:`, track.name);
        console.log(`트랙 타입:`, track.constructor.name);
        console.log(`트랙 데이터:`, {
          times: track.times?.length || 0,
          values: track.values?.length || 0,
          duration: track.times ? track.times[track.times.length - 1] : 0
        });
        
        // 트랙 이름에서 노드 이름과 속성 추출
        const trackParts = track.name.split('.');
        const nodeName = trackParts[0];
        const property = trackParts[1];
        
        console.log(`노드 이름: ${nodeName}, 속성: ${property}`);
        
        // 해당 노드 찾기
        const targetNode = root.listNodes().find(node => node.getName() === nodeName);
        if (!targetNode) {
          console.warn(`애니메이션 타겟 노드를 찾을 수 없음: ${nodeName}`);
          return;
        }
        
        console.log(`타겟 노드 찾음: ${targetNode.getName()}`);
        
        // 시간 데이터와 값 데이터 확인
        const times = track.times;
        const values = track.values;
        
        if (!times || !values || times.length === 0 || values.length === 0) {
          console.warn(`애니메이션 트랙 데이터가 없음: ${track.name}`);
          return;
        }
        
        console.log(`데이터 크기 - times: ${times.length}, values: ${values.length}`);
        console.log(`시간 범위: ${times[0]} ~ ${times[times.length - 1]}`);
        console.log(`첫 번째 값:`, values.slice(0, Math.min(4, values.length)));
        
        // 데이터 유효성 검증
        if (times[times.length - 1] <= 0) {
          console.warn(`유효하지 않은 애니메이션 지속시간: ${times[times.length - 1]}`);
          return;
        }
        
        // Accessor 생성 (시간)
        const timeAccessor = document.createAccessor()
          .setArray(new Float32Array(times))
          .setType('SCALAR')
          .setBuffer(buffer);
        
        // Accessor 생성 (값) - 속성에 따라 타입 결정
        let valueAccessor;
        let targetPath = property;
        
        if (property === 'position' || property === 'scale') {
          valueAccessor = document.createAccessor()
            .setArray(new Float32Array(values))
            .setType('VEC3')
            .setBuffer(buffer);
        } else if (property === 'quaternion') {
          targetPath = 'rotation'; // glTF에서는 rotation으로 사용
          valueAccessor = document.createAccessor()
            .setArray(new Float32Array(values))
            .setType('VEC4')
            .setBuffer(buffer);
        } else {
          console.warn(`지원하지 않는 애니메이션 속성: ${property}`);
          return;
        }
        
        // 샘플러 생성
        const sampler = document.createAnimationSampler()
          .setInput(timeAccessor)
          .setOutput(valueAccessor)
          .setInterpolation('LINEAR'); // 기본값
        
        // 채널 생성
        const channel = document.createAnimationChannel()
          .setTargetNode(targetNode)
          .setTargetPath(targetPath)
          .setSampler(sampler);
        
        gltfAnimation.addSampler(sampler);
        gltfAnimation.addChannel(channel);
        
        validTrackCount++;
        console.log(`트랙 ${trackIndex} 추가 완료: ${nodeName}.${targetPath}`);
        
      } catch (trackError) {
        console.error(`트랙 처리 실패 (${track.name}):`, trackError);
      }
    });
    
    if (gltfAnimation.listChannels().length > 0) {
      // Document에 애니메이션 추가
      root.listAnimations().push(gltfAnimation);
      console.log(`최종 애니메이션 채널 수: ${gltfAnimation.listChannels().length}`);
      console.log(`유효 트랙 수: ${validTrackCount}/${animationClip.tracks.length}`);
      console.log(`애니메이션 "${animationClip.name}" Document에 추가 완료`);
      console.log(`현재 Document 총 애니메이션 수: ${root.listAnimations().length}`);
      return true;
    } else {
      console.warn('생성된 채널이 없어서 애니메이션을 추가하지 않음');
      return false;
    }
    
  } catch (error) {
    console.error('Document에 애니메이션 추가 실패:', error);
    return false;
  }
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

/**
 * 서로 다른 Document 간에 노드 복사 - DEPRECATED
 */
function copyNodeBetweenDocuments(
  sourceDocument: Document,
  targetDocument: Document, 
  sourceNodeId: string,
  targetParentId: string
): boolean {
  try {
    const sourceNode = findNodeByIdInDocument(sourceDocument, sourceNodeId)
    if (!sourceNode) {
      console.warn(`Source node ${sourceNodeId} not found in source document`)
      return false
    }

    const targetParent = findNodeByIdInDocument(targetDocument, targetParentId) || 
                        findSceneByIdInDocument(targetDocument, targetParentId)
    if (!targetParent) {
      console.warn(`Target parent ${targetParentId} not found in target document`)
      return false
    }

    // 서로 다른 Document 간 노드 복사
    const copiedNode = cloneNodeBetweenDocuments(sourceDocument, targetDocument, sourceNode)
    
    // 새 부모에 추가
    if (targetParent instanceof Node) {
      targetParent.addChild(copiedNode)
      console.log(`Copied node from source document to ${targetParent.getName()}`)
    } else if (targetParent instanceof Scene) {
      targetParent.addChild(copiedNode)
      console.log(`Copied node from source document to scene ${targetParent.getName()}`)
    }

    return true
  } catch (error) {
    console.error(`Failed to copy node between documents:`, error)
    return false
  }
}

/**
 * 서로 다른 Document 간 노드 복사 (간단한 버전)
 */
function cloneNodeBetweenDocuments(sourceDoc: Document, targetDoc: Document, sourceNode: Node): Node {
  // 간단한 노드 복사 - 기본 속성만
  const newNode = targetDoc.createNode()
    .setName(`${sourceNode.getName()}_copy`)
    .setTranslation(sourceNode.getTranslation())
    .setRotation(sourceNode.getRotation())
    .setScale(sourceNode.getScale())

  // 메시가 있는 경우 참조만 복사 (실제 메시 데이터는 복사하지 않음)
  // 이는 단순화된 버전이며, 필요시 확장 가능
  console.log(`Cloned node: ${sourceNode.getName()} -> ${newNode.getName()}`)
  
  // 자식 노드들 재귀 복사
  sourceNode.listChildren().forEach(childNode => {
    const clonedChild = cloneNodeBetweenDocuments(sourceDoc, targetDoc, childNode)
    newNode.addChild(clonedChild)
  })
  
  return newNode
}