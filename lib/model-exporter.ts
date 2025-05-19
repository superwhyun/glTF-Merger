import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"

/**
 * 모델 구조를 GLB 파일로 내보내는 함수
 * @param scene Three.js 씬 객체
 * @param fileName 저장할 파일 이름
 */
export function exportModelToGLB(scene: THREE.Scene, fileName: string): void {
  // 원본 씬을 수정하지 않기 위해 복제
  const exportScene = new THREE.Scene()

  console.log("내보내기 시작: 씬 구조 분석 중...")

  // 씬 내 객체 수 확인
  let objectCount = 0
  let meshCount = 0
  let groupCount = 0

  scene.traverse((object) => {
    objectCount++
    if (object instanceof THREE.Mesh) meshCount++
    if (object instanceof THREE.Group) groupCount++
  })

  console.log(`씬 내 객체 수: ${objectCount}, 메시: ${meshCount}, 그룹: ${groupCount}`)

  // 모델만 찾아서 복제
  let modelFound = false

  // 모델 객체 찾기 (Group 또는 Object3D)
  scene.traverse((object) => {
    // 그리드 헬퍼는 제외
    if (object instanceof THREE.GridHelper) {
      return
    }

    // 메시나 그룹 객체를 찾아 내보내기
    if (
      (object instanceof THREE.Mesh || object instanceof THREE.Group || object instanceof THREE.Object3D) &&
      object !== scene &&
      object.parent === scene // 씬의 직접적인 자식만 선택
    ) {
      console.log(`내보낼 객체 발견: ${object.type}`, object)

      // 객체 복제
      const clone = object.clone(true) // true: 자식 객체도 모두 복제

      // 위치, 회전, 스케일 복사
      clone.position.copy(object.position)
      clone.rotation.copy(object.rotation)
      clone.scale.copy(object.scale)

      exportScene.add(clone)
      modelFound = true
    }
  })

  // 모델이 없는 경우 씬 전체를 내보내기 (그리드 헬퍼 제외)
  if (!modelFound) {
    console.log("씬에서 직접적인 모델 객체를 찾을 수 없어 전체 씬을 내보냅니다 (그리드 헬퍼 제외)")

    // 그리드 헬퍼를 제외한 모든 객체 복제
    scene.children.forEach((child) => {
      if (!(child instanceof THREE.GridHelper)) {
        const clone = child.clone(true)
        exportScene.add(clone)
        modelFound = true
      }
    })
  }

  // 여전히 모델이 없으면 오류 발생
  if (!modelFound) {
    console.error("내보낼 모델을 찾을 수 없습니다. 씬 구조:", scene)
    throw new Error("내보낼 모델을 찾을 수 없습니다. 모델이 올바르게 로드되었는지 확인하세요.")
  }

  const exporter = new GLTFExporter()

  // GLB 형식으로 내보내기 (바이너리 형식)
  exporter.parse(
    exportScene,
    (buffer) => {
      // 바이너리 데이터를 Blob으로 변환
      const blob = new Blob([buffer as ArrayBuffer], { type: "application/octet-stream" })

      // 다운로드 링크 생성
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = fileName.endsWith(".glb") ? fileName : `${fileName}.glb`

      // 링크 클릭하여 다운로드 시작
      document.body.appendChild(link)
      link.click()

      // 링크 제거
      document.body.removeChild(link)

      // URL 객체 해제
      setTimeout(() => {
        URL.revokeObjectURL(link.href)
      }, 100)

      console.log("모델 내보내기 완료:", fileName)
    },
    (error) => {
      console.error("모델 내보내기 오류:", error)
      throw new Error(`모델 내보내기 실패: ${error.message}`)
    },
    // GLB 내보내기 옵션
    {
      binary: true,
      animations: [], // 애니메이션 포함
      includeCustomExtensions: true, // 커스텀 확장(VRM 등) 포함
    },
  )
}

/**
 * 모델 구조를 업데이트하는 함수
 * @param scene Three.js 씬 객체
 * @param modelStructure 업데이트할 모델 구조
 * @returns 업데이트된 씬 객체
 */
export function updateModelFromStructure(scene: THREE.Scene, modelStructure: any): THREE.Scene {
  // 이 함수는 모델 구조를 기반으로 Three.js 씬을 업데이트합니다.
  // 실제 구현은 모델 구조의 형식과 Three.js 객체 간의 매핑에 따라 달라집니다.

  // 여기서는 간단한 예시만 제공합니다.
  // 실제 구현에서는 모델 구조의 노드, 메시, 재질, 애니메이션 등을
  // Three.js 객체로 변환하는 복잡한 로직이 필요합니다.

  return scene
}
