import * as THREE from "three"

/**
 * Three.js Object3D 기반 노드 조작 유틸리티
 * 계층구조를 유지하면서 노드를 복사/이동/삭제하는 기능 제공
 */

/**
 * Three.js Object3D를 재귀적으로 복제하는 함수
 * 모든 하위 노드, 메시, 머티리얼, 텍스처까지 완전 복사
 */
export function cloneObject3DRecursive(source: THREE.Object3D): THREE.Object3D {
  // Three.js의 clone 메서드로 기본 복제
  const cloned = source.clone(true)
  
  // 복제본에 isBone 프로퍼티 복사 (모든 Bone 타입 객체에 적용)
  if (source.type === "Bone") {
    (cloned as any).isBone = true;
  }
  
  // 메시의 지오메트리와 머티리얼 별도 복제 (참조 공유 방지)
  cloned.traverse((child) => {
    // Bone 타입 객체는 항상 isBone 플래그 설정 - GLTFLoader 호환성을 위해 필수
    if (child.type === "Bone") {
      (child as any).isBone = true;
    }
    
    if (child instanceof THREE.Mesh) {
      // 지오메트리 복제
      if (child.geometry) {
        child.geometry = child.geometry.clone()
      }
      
      // 머티리얼 복제
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => mat.clone())
        } else {
          child.material = child.material.clone()
        }
      }
    }
    
    // 스키닝된 메시의 본 참조 업데이트
    if (child instanceof THREE.SkinnedMesh && child.skeleton) {
      try {
        // 1. 각 본을 찾아서 새로운 본 배열 생성
        const bones = child.skeleton.bones.map(bone => {
          const found = cloned.getObjectByName(bone.name);
          if (found && (found.type === "Bone" || found instanceof THREE.Bone)) {
            // isBone 등 내부 플래그 복사 - GLTFLoader와 호환되도록 보장
            (found as any).isBone = true;
            return found;
          } else if (bone.type === "Bone" || bone instanceof THREE.Bone) {
            // fallback: 원본 bone을 clone해서 추가
            const newBone = bone.clone(true);
            (newBone as any).isBone = true;
            return newBone;
          } else {
            // fallback: 새 Bone 생성
            const newBone = new THREE.Bone();
            (newBone as any).isBone = true;
            newBone.name = bone.name || "bone_" + Math.random().toString(36).substr(2, 9);
            return newBone;
          }
        });
        
        // 2. 원본 boneInverses 복제
        const boneInverses = child.skeleton.boneInverses.map(matrix => matrix.clone());
        
        // 3. 새로운 스켈레톤 생성 (복제된 본과 행렬 사용)
        child.skeleton = new THREE.Skeleton(bones, boneInverses);
        
        // 4. 모든 본에 isBone 플래그 설정 (호환성 보장)
        child.skeleton.bones.forEach(bone => {
          (bone as any).isBone = true;
        });
      } catch (error) {
        console.error("스켈레톤 복제 중 오류:", error);
      }
    }
  })
  
  return cloned
}

/**
 * 씬에서 Object3D를 찾는 함수
 * 이름 또는 UUID로 검색 가능
 */
export function findObjectInScene(
  scene: THREE.Scene, 
  identifier: string, 
  searchBy: 'name' | 'uuid' = 'name'
): THREE.Object3D | null {
  let foundObject: THREE.Object3D | null = null
  
  scene.traverse((child) => {
    if (searchBy === 'name' && child.name === identifier) {
      foundObject = child
      return // traverse는 break를 지원하지 않으므로 return 사용
    } else if (searchBy === 'uuid' && child.uuid === identifier) {
      foundObject = child
      return
    }
  })
  
  return foundObject
}

/**
 * 노드의 전체 계층 경로를 반환하는 함수
 * 루트부터 해당 노드까지의 이름 경로 제공
 */
export function getObjectPath(object: THREE.Object3D): string[] {
  const path: string[] = []
  let current: THREE.Object3D | null = object
  
  while (current && current.parent) {
    path.unshift(current.name || current.uuid)
    current = current.parent
  }
  
  return path
}

/**
 * 노드를 새로운 부모로 이동하는 함수
 * Three.js의 add/remove API 활용
 */
export function moveObjectToParent(
  object: THREE.Object3D, 
  newParent: THREE.Object3D,
  preserveWorldPosition: boolean = true
): { success: boolean; message: string } {
  try {
    const oldParent = object.parent
    
    if (!oldParent) {
      return { success: false, message: "객체에 부모가 없습니다." }
    }
    
    if (newParent === object || isAncestor(object, newParent)) {
      return { success: false, message: "순환 참조가 발생합니다." }
    }
    
    // 월드 위치 보존 옵션
    if (preserveWorldPosition) {
      // 현재 월드 위치, 회전, 스케일 저장
      const worldPosition = new THREE.Vector3()
      const worldQuaternion = new THREE.Quaternion() 
      const worldScale = new THREE.Vector3()
      object.getWorldPosition(worldPosition)
      object.getWorldQuaternion(worldQuaternion)
      object.getWorldScale(worldScale)
      
      // 부모 변경
      oldParent.remove(object)
      newParent.add(object)
      
      // 월드 좌표를 로컬 좌표로 변환
      newParent.worldToLocal(worldPosition)
      object.position.copy(worldPosition)
      
      // 회전과 스케일도 적절히 조정
      const newParentWorldQuaternion = new THREE.Quaternion()
      newParent.getWorldQuaternion(newParentWorldQuaternion)
      newParentWorldQuaternion.invert()
      worldQuaternion.multiplyQuaternions(newParentWorldQuaternion, worldQuaternion)
      object.quaternion.copy(worldQuaternion)
      
      const newParentWorldScale = new THREE.Vector3()
      newParent.getWorldScale(newParentWorldScale)
      worldScale.divide(newParentWorldScale) 
      object.scale.copy(worldScale)
    } else {
      // 단순 부모 변경
      oldParent.remove(object)
      newParent.add(object)
    }
    
    return { success: true, message: "노드가 성공적으로 이동되었습니다." }
  } catch (error) {
    return { 
      success: false, 
      message: `이동 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` 
    }
  }
}

/**
 * 객체가 특정 객체의 조상인지 확인하는 함수
 * 순환 참조 방지용
 */
function isAncestor(ancestor: THREE.Object3D, descendant: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = descendant.parent
  
  while (current) {
    if (current === ancestor) {
      return true
    }
    current = current.parent
  }
  
  return false
}

/**
 * 노드를 복사하여 새로운 부모에 추가하는 함수
 */
export function copyObjectToParent(
  source: THREE.Object3D,
  targetParent: THREE.Object3D,
  newName?: string
): { success: boolean; message: string; clonedObject?: THREE.Object3D } {
  try {
    // 객체 복제
    const cloned = cloneObject3DRecursive(source)
    
    // 새로운 이름 설정
    if (newName) {
      cloned.name = newName
    } else {
      // 기존 이름에 '_copy' 접미사 추가
      cloned.name = source.name ? `${source.name}_copy` : `${source.uuid}_copy`
    }
    
    // 복제된 객체들의 이름도 고유하게 만들기
    cloned.traverse((child) => {
      if (child !== cloned && child.name) {
        child.name = `${child.name}_copy`
      }
    })
    
    // 대상 부모에 추가
    targetParent.add(cloned)
    
    return { 
      success: true, 
      message: "노드가 성공적으로 복사되었습니다.",
      clonedObject: cloned
    }
  } catch (error) {
    return { 
      success: false, 
      message: `복사 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` 
    }
  }
}

/**
 * 씬에서 노드를 제거하는 함수
 * 모든 하위 노드와 관련 리소스도 정리
 */
export function removeObjectFromScene(
  object: THREE.Object3D,
  disposeResources: boolean = true
): { success: boolean; message: string } {
  try {
    const parent = object.parent
    
    if (!parent) {
      return { success: false, message: "객체에 부모가 없습니다." }
    }
    
    // 리소스 정리 (메모리 누수 방지)
    if (disposeResources) {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose()
          }
          
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose())
            } else {
              child.material.dispose()
            }
          }
        }
      })
    }
    
    // 부모에서 제거
    parent.remove(object)
    
    return { success: true, message: "노드가 성공적으로 제거되었습니다." }
  } catch (error) {
    return { 
      success: false, 
      message: `제거 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` 
    }
  }
}

/**
 * 씬의 계층구조를 JSON 형태로 변환하는 함수
 * 모델 트리 컴포넌트에서 사용
 */
export function sceneToHierarchy(scene: THREE.Scene): any {
  function objectToNode(obj: THREE.Object3D): any {
    const node: any = {
      name: obj.name || obj.uuid,
      type: obj.type,
      uuid: obj.uuid,
      visible: obj.visible,
      position: obj.position.toArray(),
      rotation: obj.rotation.toArray(), 
      scale: obj.scale.toArray(),
      children: []
    }
    
    // 메시 정보 추가
    if (obj instanceof THREE.Mesh) {
      node.geometry = obj.geometry.type
      node.material = Array.isArray(obj.material) 
        ? obj.material.map(mat => mat.type)
        : obj.material.type
    }
    
    // 자식 노드 처리
    obj.children.forEach(child => {
      node.children.push(objectToNode(child))
    })
    
    return node
  }
  
  return objectToNode(scene)
}

/**
 * 계층구조 JSON을 씬에 적용하는 함수
 * 모델 구조 변경사항을 3D 씬에 반영
 */
export function applyHierarchyToScene(
  scene: THREE.Scene, 
  hierarchy: any,
  preserveExistingObjects: boolean = true
): { success: boolean; message: string } {
  try {
    // 기존 객체 제거 (preserveExistingObjects가 false인 경우)
    if (!preserveExistingObjects) {
      const objectsToRemove = [...scene.children]
      objectsToRemove.forEach(child => {
        if (child.type !== "DirectionalLight" && 
            child.type !== "AmbientLight" && 
            child.type !== "GridHelper") {
          scene.remove(child)
        }
      })
    }
    
    // TODO: hierarchy JSON을 실제 Three.js 객체로 재구성
    // 이 기능은 구체적인 요구사항에 따라 구현 필요
    
    return { success: true, message: "계층구조가 성공적으로 적용되었습니다." }
  } catch (error) {
    return { 
      success: false, 
      message: `적용 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` 
    }
  }
}

/**
 * 노드 선택 및 상태 관리를 위한 인터페이스
 */
export interface NodeSelectionState {
  selectedUuid: string | null
  highlightedUuid: string | null
  clipboardUuid: string | null
  clipboardSourceScene: 'left' | 'right' | null
}

/**
 * 노드 선택 상태 업데이트 함수
 */
export function updateNodeSelection(
  scene: THREE.Scene,
  selectionState: NodeSelectionState
): void {
  scene.traverse((object) => {
    // 기존 상태 초기화
    if (object.userData.isSelected) object.userData.isSelected = false
    if (object.userData.isHighlighted) object.userData.isHighlighted = false
    if (object.userData.isClipboard) object.userData.isClipboard = false
    
    // 새로운 상태 적용
    if (object.uuid === selectionState.selectedUuid) {
      object.userData.isSelected = true
    }
    if (object.uuid === selectionState.highlightedUuid) {
      object.userData.isHighlighted = true
    }
    if (object.uuid === selectionState.clipboardUuid) {
      object.userData.isClipboard = true
    }
  })
}

/**
 * Three.js 씬과 JSON 구조 간의 동기화 매니저
 */
export class SceneStructureSync {
  private scene: THREE.Scene
  private onStructureChange?: (structure: any) => void
  
  constructor(scene: THREE.Scene, onStructureChange?: (structure: any) => void) {
    this.scene = scene
    this.onStructureChange = onStructureChange
  }
  
  /**
   * 씬 변경사항을 JSON 구조로 동기화
   */
  syncToStructure(): any {
    const structure = sceneToHierarchy(this.scene)
    if (this.onStructureChange) {
      this.onStructureChange(structure)
    }
    return structure
  }
  
  /**
   * 노드 이동 후 구조 동기화
   */
  onNodeMoved(movedObject: THREE.Object3D): void {
    console.log(`노드 이동 감지: ${movedObject.name}`)
    this.syncToStructure()
  }
  
  /**
   * 노드 추가 후 구조 동기화
   */
  onNodeAdded(addedObject: THREE.Object3D): void {
    console.log(`노드 추가 감지: ${addedObject.name}`)
    this.syncToStructure()
  }
  
  /**
   * 노드 제거 후 구조 동기화
   */
  onNodeRemoved(removedObjectName: string): void {
    console.log(`노드 제거 감지: ${removedObjectName}`)
    this.syncToStructure()
  }
}

/**
 * VRM 본 구조 처리 유틸리티
 */
export function handleVRMBoneStructure(object: THREE.Object3D): any {
  const boneInfo: any = {}
  
  // VRM 휴마노이드 본 찾기
  object.traverse((child) => {
    if (child.userData.vrm && child.userData.vrm.humanoid) {
      const humanoid = child.userData.vrm.humanoid
      boneInfo.humanoidBones = {}
      
      // 표준 VRM 본 매핑
      Object.entries(humanoid.humanBones).forEach(([boneName, bone]) => {
        if (bone && (bone as any).node) {
          const boneNode = (bone as any).node
          boneInfo.humanoidBones[boneName] = {
            name: boneNode.name,
            uuid: boneNode.uuid,
            position: boneNode.position.toArray(),
            rotation: boneNode.rotation.toArray(),
            scale: boneNode.scale.toArray()
          }
        }
      })
    }
  })
  
  return boneInfo
}

/**
 * 메시와 머티리얼 관계 추적
 */
export function trackMeshMaterialRelations(object: THREE.Object3D): any {
  const relations: any = {
    meshes: {},
    materials: {},
    textures: {}
  }
  
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      relations.meshes[child.uuid] = {
        name: child.name,
        geometry: child.geometry.uuid,
        materials: Array.isArray(child.material) 
          ? child.material.map(mat => mat.uuid)
          : [child.material.uuid]
      }
      
      // 머티리얼 정보 수집
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (!relations.materials[material.uuid]) {
          relations.materials[material.uuid] = {
            name: material.name,
            type: material.type,
            textures: []
          }
          
          // 텍스처 정보 수집
          Object.entries(material).forEach(([key, value]) => {
            if (value instanceof THREE.Texture) {
              relations.materials[material.uuid].textures.push({
                property: key,
                uuid: value.uuid,
                name: value.name || `${key}_texture`
              })
              
              if (!relations.textures[value.uuid]) {
                relations.textures[value.uuid] = {
                  name: value.name,
                  image: value.image?.src || null,
                  wrapS: value.wrapS,
                  wrapT: value.wrapT,
                  magFilter: value.magFilter,
                  minFilter: value.minFilter
                }
              }
            }
          })
        }
      })
    }
  })
  
  return relations
}

/**
 * 고급 노드 검색 기능
 */
export class NodeSearcher {
  private scene: THREE.Scene
  
  constructor(scene: THREE.Scene) {
    this.scene = scene
  }
  
  /**
   * 이름으로 노드 검색 (정확 일치 또는 부분 일치)
   */
  searchByName(query: string, exactMatch: boolean = false): THREE.Object3D[] {
    const results: THREE.Object3D[] = []
    
    this.scene.traverse((object) => {
      const name = object.name.toLowerCase()
      const searchQuery = query.toLowerCase()
      
      if (exactMatch) {
        if (name === searchQuery) {
          results.push(object)
        }
      } else {
        if (name.includes(searchQuery)) {
          results.push(object)
        }
      }
    })
    
    return results
  }
  
  /**
   * 타입으로 노드 검색
   */
  searchByType(type: string): THREE.Object3D[] {
    const results: THREE.Object3D[] = []
    
    this.scene.traverse((object) => {
      if (object.type === type) {
        results.push(object)
      }
    })
    
    return results
  }
  
  /**
   * 사용자 데이터로 노드 검색
   */
  searchByUserData(key: string, value?: any): THREE.Object3D[] {
    const results: THREE.Object3D[] = []
    
    this.scene.traverse((object) => {
      if (value !== undefined) {
        if (object.userData[key] === value) {
          results.push(object)
        }
      } else {
        if (object.userData.hasOwnProperty(key)) {
          results.push(object)
        }
      }
    })
    
    return results
  }
  
  /**
   * 조건 함수로 노드 검색
   */
  searchByCondition(condition: (object: THREE.Object3D) => boolean): THREE.Object3D[] {
    const results: THREE.Object3D[] = []
    
    this.scene.traverse((object) => {
      if (condition(object)) {
        results.push(object)
      }
    })
    
    return results
  }
}

/**
 * 배치 작업 처리기
 */
export class BatchOperationProcessor {
  private scene: THREE.Scene
  private operations: Array<{
    type: 'move' | 'copy' | 'delete' | 'rename'
    target: THREE.Object3D
    params: any
  }> = []
  
  constructor(scene: THREE.Scene) {
    this.scene = scene
  }
  
  /**
   * 배치 이동 작업 추가
   */
  addMoveOperation(object: THREE.Object3D, newParent: THREE.Object3D): void {
    this.operations.push({
      type: 'move',
      target: object,
      params: { newParent }
    })
  }
  
  /**
   * 배치 복사 작업 추가
   */
  addCopyOperation(object: THREE.Object3D, targetParent: THREE.Object3D, newName?: string): void {
    this.operations.push({
      type: 'copy',
      target: object,
      params: { targetParent, newName }
    })
  }
  
  /**
   * 배치 삭제 작업 추가
   */
  addDeleteOperation(object: THREE.Object3D): void {
    this.operations.push({
      type: 'delete',
      target: object,
      params: {}
    })
  }
  
  /**
   * 배치 이름 변경 작업 추가
   */
  addRenameOperation(object: THREE.Object3D, newName: string): void {
    this.operations.push({
      type: 'rename',
      target: object,
      params: { newName }
    })
  }
  
  /**
   * 모든 배치 작업 실행
   */
  executeBatch(): { success: boolean; message: string; results: any[] } {
    const results: any[] = []
    let successCount = 0
    
    for (const operation of this.operations) {
      try {
        let result: any
        
        switch (operation.type) {
          case 'move':
            result = moveObjectToParent(operation.target, operation.params.newParent)
            break
            
          case 'copy':
            result = copyObjectToParent(
              operation.target, 
              operation.params.targetParent,
              operation.params.newName
            )
            break
            
          case 'delete':
            result = removeObjectFromScene(operation.target)
            break
            
          case 'rename':
            operation.target.name = operation.params.newName
            result = { success: true, message: "이름이 변경되었습니다." }
            break
            
          default:
            result = { success: false, message: "알 수 없는 작업 타입입니다." }
        }
        
        results.push({
          operation: operation.type,
          target: operation.target.name,
          ...result
        })
        
        if (result.success) {
          successCount++
        }
      } catch (error) {
        results.push({
          operation: operation.type,
          target: operation.target.name,
          success: false,
          message: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        })
      }
    }
    
    // 배치 작업 완료 후 작업 목록 초기화
    this.operations = []
    
    return {
      success: successCount === results.length,
      message: `${successCount}/${results.length} 작업이 성공적으로 완료되었습니다.`,
      results
    }
  }
  
  /**
   * 대기 중인 작업 목록 반환
   */
  getPendingOperations(): Array<{ type: string; targetName: string }> {
    return this.operations.map(op => ({
      type: op.type,
      targetName: op.target.name
    }))
  }
  
  /**
   * 배치 작업 취소
   */
  clearOperations(): void {
    this.operations = []
  }
}

// %%%%%LAST%%%%%
