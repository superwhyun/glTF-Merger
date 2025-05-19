/**
 * 객체의 특정 경로에 있는 값을 가져오는 함수
 */
export function getValueAtPath(obj: any, path: string[]): any {
  if (!obj || path.length === 0) return obj

  let current = obj
  for (const key of path) {
    if (current === undefined || current === null) return undefined
    current = current[key]
  }
  return current
}

/**
 * 객체의 특정 경로에 값을 설정하는 함수
 */
export function setValueAtPath(obj: any, path: string[], value: any): any {
  if (!obj) return obj
  if (path.length === 0) return value

  const result = { ...obj }
  let current = result

  // 마지막 키 이전까지 경로 탐색
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    if (current[key] === undefined || current[key] === null) {
      current[key] = {}
    } else {
      current[key] = { ...current[key] }
    }
    current = current[key]
  }

  // 마지막 키에 값 설정
  const lastKey = path[path.length - 1]
  current[lastKey] = value

  return result
}

/**
 * 객체의 특정 경로에 있는 값을 삭제하는 함수
 */
export function deleteValueAtPath(obj: any, path: string[]): any {
  if (!obj || path.length === 0) return obj

  const result = { ...obj }
  let current = result

  // 마지막 키 이전까지 경로 탐색
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    if (current[key] === undefined) return result // 경로가 존재하지 않으면 원본 반환
    current[key] = { ...current[key] }
    current = current[key]
  }

  // 마지막 키 삭제
  const lastKey = path[path.length - 1]
  if (current[lastKey] !== undefined) {
    const newCurrent = { ...current }
    delete newCurrent[lastKey]

    // 마지막 키 이전까지의 경로에 새 객체 설정
    if (path.length === 1) {
      return newCurrent
    } else {
      const parentPath = path.slice(0, -1)
      return setValueAtPath(result, parentPath, newCurrent)
    }
  }

  return result
}

/**
 * 복사된 데이터가 대상 모델 구조와 호환되는지 확인하는 함수
 */
export function isCompatible(sourceData: any, targetStructure: any, targetPath: string[]): boolean {
  // 기본적인 호환성 검사 로직
  // 실제 구현에서는 더 복잡한 검사가 필요할 수 있음

  // 대상 경로가 존재하는지 확인
  const targetParent = getValueAtPath(targetStructure, targetPath.length > 0 ? targetPath.slice(0, -1) : [])

  if (!targetParent) return false

  // 소스 데이터 타입 확인
  const sourceType = typeof sourceData

  // 대상이 객체이고 소스가 객체인 경우 호환 가능
  if (sourceType === "object" && targetParent && typeof targetParent === "object") {
    return true
  }

  // 기본 타입(문자열, 숫자 등)은 항상 호환 가능
  if (sourceType !== "object") {
    return true
  }

  return false
}

/**
 * 모델 구조에 노드를 추가하는 함수
 */
export function addNodeToStructure(structure: any, path: string[], nodeName: string, nodeData: any): any {
  const parentPath = path.length > 0 ? path : []
  const parent = getValueAtPath(structure, parentPath)

  if (!parent || typeof parent !== "object") {
    return structure // 부모가 객체가 아니면 추가 불가
  }

  // 새 노드 이름이 이미 존재하는 경우 고유한 이름 생성
  let uniqueName = nodeName
  let counter = 1
  while (parent[uniqueName] !== undefined) {
    uniqueName = `${nodeName}_${counter}`
    counter++
  }

  // 새 경로 생성 및 값 설정
  const newPath = [...parentPath, uniqueName]
  return setValueAtPath(structure, newPath, JSON.parse(JSON.stringify(nodeData))) // 깊은 복사 사용
}

/**
 * 모델 구조에서 노드를 대체하는 함수
 */
export function replaceNodeInStructure(structure: any, path: string[], nodeData: any): any {
  if (path.length === 0) return JSON.parse(JSON.stringify(nodeData)) // 루트 노드 대체, 깊은 복사 사용
  return setValueAtPath(structure, path, JSON.parse(JSON.stringify(nodeData))) // 깊은 복사 사용
}

/**
 * 복사/붙여넣기 작업 결과를 생성하는 함수
 */
export function createPasteResult(
  sourceData: any,
  targetStructure: any,
  targetPath: string[],
  mode: "add" | "replace",
): { success: boolean; result: any; message: string } {
  // 호환성 검사
  if (!isCompatible(sourceData.data, targetStructure, targetPath)) {
    return {
      success: false,
      result: targetStructure,
      message: "호환되지 않는 데이터 구조입니다.",
    }
  }

  try {
    let result

    if (mode === "add") {
      // 마지막 경로 요소를 노드 이름으로 사용
      const nodeName = sourceData.path.length > 0 ? sourceData.path[sourceData.path.length - 1] : "copied_node"

      result = addNodeToStructure(targetStructure, targetPath, nodeName, sourceData.data)
    } else {
      result = replaceNodeInStructure(targetStructure, targetPath, sourceData.data)
    }

    return {
      success: true,
      result,
      message: "성공적으로 붙여넣었습니다.",
    }
  } catch (error) {
    return {
      success: false,
      result: targetStructure,
      message: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    }
  }
}

/**
 * 모델 구조에서 노드를 삭제하는 함수
 */
export function deleteNodeFromStructure(
  structure: any,
  path: string[],
): { success: boolean; result: any; message: string } {
  try {
    // 루트 노드는 삭제할 수 없음
    if (path.length === 0) {
      return {
        success: false,
        result: structure,
        message: "루트 노드는 삭제할 수 없습니다.",
      }
    }

    // 노드가 존재하는지 확인
    const nodeToDelete = getValueAtPath(structure, path)
    if (nodeToDelete === undefined) {
      return {
        success: false,
        result: structure,
        message: "삭제할 노드를 찾을 수 없습니다.",
      }
    }

    // 노드 삭제
    const result = deleteValueAtPath(structure, path)

    return {
      success: true,
      result,
      message: "노드가 성공적으로 삭제되었습니다.",
    }
  } catch (error) {
    return {
      success: false,
      result: structure,
      message: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    }
  }
}
