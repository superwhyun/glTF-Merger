import * as THREE from "three"

/**
 * FBX 애니메이션에서 사용되는 본 이름들을 출력하는 함수
 */
export function logFBXBoneNames(animationClips: THREE.AnimationClip[]): void {
  console.log('🔍 FBX 애니메이션 본 이름 분석 시작')
  
  const uniqueBoneNames = new Set<string>()
  
  for (const clip of animationClips) {
    console.log(`\n📋 애니메이션 클립: "${clip.name}"`)
    console.log(`   지속시간: ${clip.duration}초, 트랙 수: ${clip.tracks.length}개`)
    
    for (const track of clip.tracks) {
      const [boneName, property] = track.name.split('.')
      uniqueBoneNames.add(boneName)
      
      // 처음 10개 트랙만 상세 출력
      // if (clip.tracks.indexOf(track) < 10) {
      //   console.log(`   트랙: ${track.name} (${property})`)
      // }
    }
  }
  
  console.log(`\n🦴 FBX에서 발견된 고유 본 이름들 (총 ${uniqueBoneNames.size}개):`)
  const sortedBoneNames = Array.from(uniqueBoneNames).sort()
  sortedBoneNames.forEach((boneName, index) => {
    console.log(`   ${index + 1}. ${boneName}`)
  })
  
  console.log('\n🔍 FBX 본 이름 분석 완료\n')
}

/**
 * GLB 모델에서 사용되는 본 이름들을 출력하는 함수
 */
export function logGLBBoneNames(targetModel: THREE.Object3D): void {
  console.log('🔍 GLB 모델 본 이름 분석 시작')
  
  const modelBoneNames: string[] = []
  
  targetModel.traverse((object) => {
    if (object.name && (object.type === 'Bone' || object.name.toLowerCase().includes('bone') || object.parent)) {
      modelBoneNames.push(object.name)
    }
  })
  
  console.log(`\n🦴 GLB 모델에서 발견된 본 이름들 (총 ${modelBoneNames.length}개):`)
  modelBoneNames.forEach((boneName, index) => {
    console.log(`   ${index + 1}. ${boneName}`)
  })
  
  console.log('\n🔍 GLB 모델 본 이름 분석 완료\n')
}
/**
 * 애니메이션 트랙의 본 이름을 모델의 실제 본 이름에 맞게 리맵핑합니다.
 */
export function remapAnimationTracks(
  animationClips: THREE.AnimationClip[], 
  targetModel: THREE.Object3D
): THREE.AnimationClip[] {
  console.log('🔄 애니메이션 트랙 리맵핑 시작')
  
  // FBX 본 이름 분석 출력
  logFBXBoneNames(animationClips)
  
  // GLB 모델 본 이름 분석 출력
  logGLBBoneNames(targetModel)
  
  // 리맵핑 하지 않고 원본 애니메이션 반환
  console.log('⚠️ 리맵핑 기능이 주석처리됨, 원본 애니메이션 반환')
  return animationClips
}

/**
 * 본 이름을 정규화합니다 (mixamorig, Armature 등 접두어 제거)
 */
function normalizeBoneName(boneName: string): string {
  return boneName
    .replace(/^mixamorig:?/i, '') // mixamorig: 제거
    .replace(/^Armature_?/i, '') // Armature_ 제거  
    .replace(/^Root_?/i, '') // Root_ 제거
    .replace(/^Skeleton_?/i, '') // Skeleton_ 제거
    .replace(/[\s_-]+/g, '') // 공백, 언더스코어, 하이픈 제거
    .toLowerCase() // 소문자 변환
}

/**
 * 본 이름 매핑 테이블 (일반적인 변환)
 */
const BONE_NAME_MAPPING: { [key: string]: string[] } = {
  // 엉덩이/루트
  'hips': ['hips', 'pelvis', 'root', 'hip'],
  
  // 척추
  'spine': ['spine', 'spine1', 'back'],
  'spine1': ['spine1', 'spine2', 'chest'],
  'spine2': ['spine2', 'spine3', 'upperchest'],
  
  // 목/머리
  'neck': ['neck', 'neck1'],
  'head': ['head', 'skull'],
  
  // 왼쪽 팔
  'leftshoulder': ['leftshoulder', 'leftclavicle', 'lshoulder'],
  'leftarm': ['leftarm', 'leftupperarm', 'larm', 'lupperarm'],
  'leftforearm': ['leftforearm', 'leftlowerarm', 'lforearm', 'llowerarm'],
  'lefthand': ['lefthand', 'lhand'],
  
  // 오른쪽 팔
  'rightshoulder': ['rightshoulder', 'rightclavicle', 'rshoulder'],
  'rightarm': ['rightarm', 'rightupperarm', 'rarm', 'rupperarm'],
  'rightforearm': ['rightforearm', 'rightlowerarm', 'rforearm', 'rlowerarm'],
  'righthand': ['righthand', 'rhand'],
  
  // 왼쪽 다리
  'leftupleg': ['leftupleg', 'leftthigh', 'leftupperleg', 'lupleg', 'lthigh'],
  'leftleg': ['leftleg', 'leftshin', 'leftlowerleg', 'lleg', 'lshin'],
  'leftfoot': ['leftfoot', 'lfoot'],
  'lefttoebase': ['lefttoebase', 'lefttoe', 'ltoebase', 'ltoe'],
  
  // 오른쪽 다리  
  'rightupleg': ['rightupleg', 'rightthigh', 'rightupperleg', 'rupleg', 'rthigh'],
  'rightleg': ['rightleg', 'rightshin', 'rightlowerleg', 'rleg', 'rshin'],
  'rightfoot': ['rightfoot', 'rfoot'],
  'righttoebase': ['righttoebase', 'righttoe', 'rtoebase', 'rtoe']
}

/**
 * 향상된 본 이름 매칭 (매핑 테이블 활용)
 */
export function findBestBoneMatch(animationBoneName: string, modelBones: string[]): string | null {
  const normalizedAnimBone = normalizeBoneName(animationBoneName)
  
  // 1. 직접 매칭 시도
  for (const modelBone of modelBones) {
    if (normalizeBoneName(modelBone) === normalizedAnimBone) {
      return modelBone
    }
  }
  
  // 2. 매핑 테이블 활용
  for (const [standardName, variations] of Object.entries(BONE_NAME_MAPPING)) {
    if (variations.includes(normalizedAnimBone)) {
      // 표준 이름에 해당하는 모델 본 찾기
      for (const modelBone of modelBones) {
        const normalizedModelBone = normalizeBoneName(modelBone)
        if (variations.includes(normalizedModelBone)) {
          return modelBone
        }
      }
    }
  }
  
  // 3. 부분 매칭 시도 (유사도 기반)
  let bestMatch: string | null = null
  let highestScore = 0
  
  for (const modelBone of modelBones) {
    const score = calculateSimilarity(normalizedAnimBone, normalizeBoneName(modelBone))
    if (score > highestScore && score > 0.6) { // 60% 이상 유사할 때만
      highestScore = score
      bestMatch = modelBone
    }
  }
  
  return bestMatch
}

/**
 * 문자열 유사도 계산 (Levenshtein distance 기반)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  
  if (len1 === 0) return len2 === 0 ? 1 : 0
  if (len2 === 0) return 0
  
  const matrix: number[][] = []
  
  // 초기화
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }
  
  // 계산
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // 삭제
        matrix[i][j - 1] + 1,     // 삽입
        matrix[i - 1][j - 1] + cost // 교체
      )
    }
  }
  
  const maxLen = Math.max(len1, len2)
  return (maxLen - matrix[len1][len2]) / maxLen
}

// %%%%%LAST%%%%%