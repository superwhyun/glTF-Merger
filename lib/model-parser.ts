/**
 * GLB/VRM 파일을 파싱하여 구조를 추출하는 함수
 */
export async function parseGLTF(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        if (!event.target || !event.target.result) {
          throw new Error("파일을 읽을 수 없습니다.")
        }

        const arrayBuffer = event.target.result as ArrayBuffer

        // GLB 파일 구조 파싱
        const structure = parseGLBStructure(arrayBuffer)
        resolve(structure)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => {
      reject(new Error("파일 읽기 오류가 발생했습니다."))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * GLB 바이너리 데이터에서 구조 정보를 추출하는 함수
 */
function parseGLBStructure(arrayBuffer: ArrayBuffer): any {
  // GLB 헤더 파싱 (12바이트)
  const headerView = new DataView(arrayBuffer, 0, 12)
  const magic = headerView.getUint32(0, true) // GLB 매직 넘버 (0x46546C67)
  const version = headerView.getUint32(4, true) // GLB 버전
  const length = headerView.getUint32(8, true) // 전체 파일 길이

  // JSON 청크 파싱
  const chunkView = new DataView(arrayBuffer, 12, 8)
  const chunkLength = chunkView.getUint32(0, true) // JSON 청크 길이
  const chunkType = chunkView.getUint32(4, true) // 청크 타입 (0x4E4F534A for JSON)

  // JSON 데이터 추출
  const jsonData = arrayBuffer.slice(20, 20 + chunkLength)
  const decoder = new TextDecoder("utf-8")
  const jsonString = decoder.decode(jsonData)
  const gltf = JSON.parse(jsonString)

  // 기본 구조 생성
  const structure: any = {
    metadata: {
      version,
      generator: gltf.asset?.generator || "Unknown",
      copyright: gltf.asset?.copyright || "Unknown",
    },
    scenes: {},
    nodes: {},
    meshes: {},
    materials: {},
    textures: {},
    animations: {},
  }

  // 씬 정보 추가
  if (gltf.scenes) {
    gltf.scenes.forEach((scene: any, index: number) => {
      structure.scenes[`scene_${index}`] = {
        name: scene.name || `Scene ${index}`,
        nodes: scene.nodes || [],
      }
    })
  }

  // 노드 정보 추가
  if (gltf.nodes) {
    gltf.nodes.forEach((node: any, index: number) => {
      structure.nodes[`node_${index}`] = {
        name: node.name || `Node ${index}`,
        mesh: node.mesh !== undefined ? `mesh_${node.mesh}` : undefined,
        children: node.children || [],
        translation: node.translation,
        rotation: node.rotation,
        scale: node.scale,
      }
    })
  }

  // 메시 정보 추가
  if (gltf.meshes) {
    gltf.meshes.forEach((mesh: any, index: number) => {
      structure.meshes[`mesh_${index}`] = {
        name: mesh.name || `Mesh ${index}`,
        primitives:
          mesh.primitives?.map((prim: any, primIndex: number) => ({
            material: prim.material !== undefined ? `material_${prim.material}` : undefined,
            attributes: prim.attributes,
            mode: prim.mode,
          })) || [],
      }
    })
  }

  // 재질 정보 추가
  if (gltf.materials) {
    gltf.materials.forEach((material: any, index: number) => {
      structure.materials[`material_${index}`] = {
        name: material.name || `Material ${index}`,
        pbrMetallicRoughness: material.pbrMetallicRoughness,
        normalTexture: material.normalTexture,
        occlusionTexture: material.occlusionTexture,
        emissiveTexture: material.emissiveTexture,
        emissiveFactor: material.emissiveFactor,
        alphaMode: material.alphaMode,
        alphaCutoff: material.alphaCutoff,
        doubleSided: material.doubleSided,
      }
    })
  }

  // 텍스처 정보 추가
  if (gltf.textures) {
    gltf.textures.forEach((texture: any, index: number) => {
      structure.textures[`texture_${index}`] = {
        name: texture.name || `Texture ${index}`,
        source: texture.source !== undefined ? `image_${texture.source}` : undefined,
        sampler: texture.sampler !== undefined ? `sampler_${texture.sampler}` : undefined,
      }
    })
  }

  // 애니메이션 정보 추가 (더 자세한 정보 포함)
  if (gltf.animations) {
    gltf.animations.forEach((animation: any, index: number) => {
      const animationData: any = {
        name: animation.name || `Animation ${index}`,
        duration: 0, // 기본값
        channels: [],
        samplers: [],
      }

      // 채널 정보 추가
      if (animation.channels) {
        animation.channels.forEach((channel: any, channelIndex: number) => {
          const targetNode = channel.target.node !== undefined ? `node_${channel.target.node}` : undefined
          const targetPath = channel.target.path

          animationData.channels.push({
            target: {
              node: targetNode,
              path: targetPath,
            },
            sampler: channel.sampler,
          })
        })
      }

      // 샘플러 정보 추가
      if (animation.samplers) {
        animation.samplers.forEach((sampler: any, samplerIndex: number) => {
          const inputAccessor = gltf.accessors?.[sampler.input]
          const outputAccessor = gltf.accessors?.[sampler.output]

          // 애니메이션 길이 계산 (입력 액세서의 최대값)
          if (inputAccessor && inputAccessor.max && inputAccessor.max.length > 0) {
            const maxTime = inputAccessor.max[0]
            if (maxTime > animationData.duration) {
              animationData.duration = maxTime
            }
          }

          animationData.samplers.push({
            interpolation: sampler.interpolation || "LINEAR",
            input: sampler.input, // 시간 데이터 액세서 인덱스
            output: sampler.output, // 변환 데이터 액세서 인덱스
          })
        })
      }

      structure.animations[`animation_${index}`] = animationData
    })
  }

  // VRM 확장 정보 추가 (VRM 파일인 경우)
  if (gltf.extensions?.VRM) {
    structure.vrm = {
      meta: gltf.extensions.VRM.meta,
      humanoid: {
        humanBones: gltf.extensions.VRM.humanoid?.humanBones || [],
      },
      blendShapeMaster: {
        blendShapeGroups: gltf.extensions.VRM.blendShapeMaster?.blendShapeGroups || [],
      },
      firstPerson: gltf.extensions.VRM.firstPerson,
      materialProperties: gltf.extensions.VRM.materialProperties,
    }
  }

  return structure
}
