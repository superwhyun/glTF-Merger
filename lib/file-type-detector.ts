/**
 * 파일 타입 감지 유틸리티
 * 파일 확장자와 내용을 모두 확인하여 정확한 타입을 판별합니다.
 */

export interface FileTypeInfo {
  type: 'VRM' | 'GLB' | 'VRMA' | 'UNKNOWN'
  hasVRMExtension: boolean
  hasVRMContent: boolean
  filename: string
  extension: string
}

/**
 * 파일의 타입을 종합적으로 분석합니다.
 */
export async function detectFileType(file: File): Promise<FileTypeInfo> {
  const filename = file.name
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  
  console.log(`🔍 [파일 타입 감지] 파일명: ${filename}, 확장자: ${extension}`)
  
  // 1. 확장자 기반 1차 판별
  const hasVRMExtension = extension === 'vrm'
  const hasVRMAExtension = extension === 'vrma'
  const hasGLBExtension = extension === 'glb'
  
  // 2. 파일 내용 분석
  const arrayBuffer = await file.arrayBuffer()
  const hasVRMContent = await checkVRMContent(arrayBuffer)
  const hasVRMAContent = await checkVRMAContent(arrayBuffer)
  
  console.log(`🔍 [파일 타입 감지] 확장자 분석: VRM=${hasVRMExtension}, VRMA=${hasVRMAExtension}, GLB=${hasGLBExtension}`)
  console.log(`🔍 [파일 타입 감지] 내용 분석: VRM=${hasVRMContent}, VRMA=${hasVRMAContent}`)
  
  // 3. 종합 판별
  let type: FileTypeInfo['type'] = 'UNKNOWN'
  
  if (hasVRMAExtension || hasVRMAContent) {
    type = 'VRMA'
  } else if (hasVRMExtension || hasVRMContent) {
    type = 'VRM'
  } else if (hasGLBExtension && !hasVRMContent) {
    type = 'GLB'
  }
  
  const result: FileTypeInfo = {
    type,
    hasVRMExtension,
    hasVRMContent,
    filename,
    extension
  }
  
  console.log(`✅ [파일 타입 감지] 최종 결과:`, result)
  return result
}


/**
 * GLB 파일 내용에서 VRM 확장을 확인합니다.
 */
async function checkVRMContent(arrayBuffer: ArrayBuffer): Promise<boolean> {
  try {
    // GLB 헤더 확인
    const headerView = new DataView(arrayBuffer, 0, 12)
    const magic = headerView.getUint32(0, true)
    
    // GLB 매직 넘버 확인 (0x46546C67 = "glTF")
    if (magic !== 0x46546C67) {
      console.log(`🔍 [VRM 내용 확인] GLB 헤더가 아님: 0x${magic.toString(16)}`)
      return false
    }
    
    // JSON 청크 파싱
    const chunkView = new DataView(arrayBuffer, 12, 8)
    const chunkLength = chunkView.getUint32(0, true)
    const chunkType = chunkView.getUint32(4, true)
    
    // JSON 청크 타입 확인 (0x4E4F534A = "JSON")
    if (chunkType !== 0x4E4F534A) {
      console.log(`🔍 [VRM 내용 확인] JSON 청크가 아님: 0x${chunkType.toString(16)}`)
      return false
    }
    
    // JSON 데이터 추출
    const jsonData = arrayBuffer.slice(20, 20 + chunkLength)
    const decoder = new TextDecoder('utf-8')
    const jsonString = decoder.decode(jsonData)
    const gltf = JSON.parse(jsonString)
    
    // VRM 확장 확인
    const hasVRM = !!(gltf.extensions?.VRM || gltf.extensions?.VRMC_vrm)
    console.log(`🔍 [VRM 내용 확인] VRM 확장 발견: ${hasVRM}`)
    
    if (hasVRM) {
      console.log(`🔍 [VRM 내용 확인] 확장 목록:`, Object.keys(gltf.extensions || {}))
    }
    
    return hasVRM
  } catch (error) {
    console.error(`❌ [VRM 내용 확인] 오류:`, error)
    return false
  }
}


/**
 * VRMA 애니메이션 파일 내용을 확인합니다.
 */
async function checkVRMAContent(arrayBuffer: ArrayBuffer): Promise<boolean> {
  try {
    // GLB 헤더 확인
    const headerView = new DataView(arrayBuffer, 0, 12)
    const magic = headerView.getUint32(0, true)
    
    if (magic !== 0x46546C67) {
      return false
    }
    
    // JSON 청크 파싱
    const chunkView = new DataView(arrayBuffer, 12, 8)
    const chunkLength = chunkView.getUint32(0, true)
    const chunkType = chunkView.getUint32(4, true)
    
    if (chunkType !== 0x4E4F534A) {
      return false
    }
    
    // JSON 데이터 추출
    const jsonData = arrayBuffer.slice(20, 20 + chunkLength)
    const decoder = new TextDecoder('utf-8')
    const jsonString = decoder.decode(jsonData)
    const gltf = JSON.parse(jsonString)
    
    // VRMA 특성 확인 (애니메이션이 주 목적이고 메시가 없거나 적음)
    const hasAnimations = gltf.animations && gltf.animations.length > 0
    const hasMinimalMeshes = !gltf.meshes || gltf.meshes.length <= 2
    const hasVRMAExtension = !!(gltf.extensions?.VRMC_vrm_animation)
    
    console.log(`🔍 [VRMA 내용 확인] 애니메이션: ${hasAnimations}, 최소 메시: ${hasMinimalMeshes}, VRMA 확장: ${hasVRMAExtension}`)
    
    return hasAnimations && (hasMinimalMeshes || hasVRMAExtension)
  } catch (error) {
    console.error(`❌ [VRMA 내용 확인] 오류:`, error)
    return false
  }
}

/**
 * 파일 타입에 따른 사용자 친화적 메시지를 반환합니다.
 */
export function getFileTypeMessage(typeInfo: FileTypeInfo): string {
  switch (typeInfo.type) {
    case 'VRM':
      return `VRM 모델 파일 (${typeInfo.filename})`
    case 'GLB':
      return `GLB 모델 파일 (${typeInfo.filename})`
    case 'VRMA':
      return `VRMA 애니메이션 파일 (${typeInfo.filename})`
    default:
      return `알 수 없는 파일 형식 (${typeInfo.filename})`
  }
}

