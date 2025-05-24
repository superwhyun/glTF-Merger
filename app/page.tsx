"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ModelViewer } from "@/components/model-viewer"
import { GLTFModelTree } from "@/components/gltf-model-tree"
import { GLTFSceneGraph } from "@/components/gltf-scene-graph"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Undo2, Redo2 } from "lucide-react"

import { type GLTFNodeInfo, moveNodeInDocument, removeNodeFromDocument } from "@/lib/gltf-transform-utils"
import { Button } from "@/components/ui/button"
import { HistoryManager } from "@/lib/history-manager"
import { ModelDownloadButton } from "@/components/model-download-button"
import { VRMADropZone } from "@/components/vrma-drop-zone"
import { AnimationDropZone } from "@/components/animation-drop-zone"
import * as THREE from "three"
import type { VRM } from "@pixiv/three-vrm"
import { showMessage } from "@/lib/showMessage"
import { useModel } from "@/hooks/useModel"

export default function Home() {
  // 히스토리 매니저 추가
  const [historyManager] = useState(() => new HistoryManager(50))

  const left = useModel(historyManager, "left")
  const right = useModel(historyManager, "right")

  // GLTFDocumentManager 참조 추가
  const leftDocumentManagerRef = useRef<any>(null)
  const rightDocumentManagerRef = useRef<any>(null)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // 씬 참조 추가
  const leftSceneRef = useRef<THREE.Scene | null>(null)
  const rightSceneRef = useRef<THREE.Scene | null>(null)

  // 히스토리 상태 업데이트
  useEffect(() => {
    setCanUndo(historyManager.canUndo())
    setCanRedo(historyManager.canRedo())
  }, [left.model, right.model, historyManager])

  // 실행 취소 함수
  const handleUndo = () => {
    const action = historyManager.undo()
    if (!action) return

    if (action.targetSide === "left") {
      left.setModel((prev) => ({ ...prev, structure: action.prevState }))
    } else {
      right.setModel((prev) => ({ ...prev, structure: action.prevState }))
    }

    showMessage("실행 취소", action.description)
  }

  // 다시 실행 함수
  const handleRedo = () => {
    const action = historyManager.redo()
    if (!action) return

    if (action.targetSide === "left") {
      left.setModel((prev) => ({ ...prev, structure: action.newState }))
    } else {
      right.setModel((prev) => ({ ...prev, structure: action.newState }))
    }

    showMessage("다시 실행", action.description)
  }

  // DocumentManager 준비 핸들러들
  const handleLeftDocumentManagerReady = useCallback((manager: any) => {
    leftDocumentManagerRef.current = manager
    left.setDocumentManager(manager)
    console.log("🟢 [PAGE] Left DocumentManager ready and saved:", manager)
  }, [left])

  const handleRightDocumentManagerReady = useCallback((manager: any) => {
    rightDocumentManagerRef.current = manager
    right.setDocumentManager(manager)
    console.log("🟢 [PAGE] Right DocumentManager ready and saved:", manager)
  }, [right])

  // 노드 가시성 제어 함수
  const handleLeftNodeVisibilityChange = useCallback((nodeId: string, visible: boolean) => {
    if (!leftSceneRef.current) return;
    console.log(`왼쪽 노드 가시성 변경 시도: ${nodeId}, 보이기: ${visible}`);
    
    // Scene 노드인 경우 (전체 씬 처리)
    if (nodeId.startsWith('scene_') && !nodeId.includes('node')) {
      if (leftSceneRef.current.children) {
        // Scene 자체가 아닌 모델만 처리 (GridHelper 등은 유지)
        const model = leftSceneRef.current.getObjectByName('exportableModel');
        if (model) {
          model.visible = visible;
          console.log(`왼쪽 모델: 전체 모델 가시성 변경됨 - ${visible ? '표시' : '숨김'}`);
        }
      }
      return;
    }
    
    // gltf-transform nodeId에서 경로 이름 추출
    try {
      // exportableModel 찾기
      const model = leftSceneRef.current.getObjectByName('exportableModel');
      if (!model) {
        console.warn('왼쪽 모델: exportableModel을 찾을 수 없음');
        return;
      }
      
      // nodeId가 scene_0_node_X_Y_Z 형식일 때 X_Y_Z 부분이 실제 계층 구조의 이름일 수 있음
      // 예: scene_0_node_1_2_3 -> Skeleton -> Hips -> Spine
      let foundNode = false;
      
      // 모든 모델의 계층 구조 순회하며 노드 이름으로 검색
      model.traverse((object) => {
        // 이미 찾았으면 더 이상 검색하지 않음
        if (foundNode) return;
        
        // 이름이 있는 노드만 처리 (익명 노드는 스킵)
        if (object.name) {
          // 전체 노드 경로 저장 (디버깅용)
          const nodePath = [];
          let current = object;
          while (current && current !== model) {
            nodePath.unshift(current.name || 'unnamed');
            current = current.parent!;
          }
          
          // 노드 ID와 계층 구조에서 이름을 기반으로 노드 찾기
          if (nodeId.includes(object.name) || 
              // 또는 노드 ID에서 추출한 숫자 인덱스로 노드 찾기
              (nodeId.match(/node_(\d+)/g) && object.name.includes(nodeId.match(/node_(\d+)/g)![0]))) {
            console.log(`왼쪽 모델: 노드를 찾음 - ${object.name}, 경로: ${nodePath.join(' -> ')}`);
            object.visible = visible;
            console.log(`왼쪽 모델: 노드 ${object.name} 가시성 변경됨 - ${visible ? '표시' : '숨김'}`);
            foundNode = true;
          }
        }
      });
      
      if (!foundNode) {
        // 인덱스 기반 탐색 시도 (scene_0_node_1_2_3 -> 1,2,3 인덱스로 찾기)
        const parts = nodeId.split('_');
        const nodeIndices: number[] = [];
        
        // '_node_' 이후의 숫자들을 인덱스로 수집
        let foundNodeKeyword = false;
        for (const part of parts) {
          if (foundNodeKeyword && !isNaN(parseInt(part))) {
            nodeIndices.push(parseInt(part));
          }
          if (part === 'node') {
            foundNodeKeyword = true;
          }
        }
        
        if (nodeIndices.length > 0) {
          console.log(`왼쪽 모델: 인덱스 기반 탐색 시도 - [${nodeIndices.join(', ')}]`);
          
          // 인덱스 경로를 따라 노드 찾기
          let targetNode = model;
          
          for (let i = 0; i < nodeIndices.length; i++) {
            const index = nodeIndices[i];
            if (targetNode.children && index < targetNode.children.length) {
              targetNode = targetNode.children[index];
            } else {
              targetNode = null;
              break;
            }
          }
          
          if (targetNode) {
            // 타깃 노드 찾음
            targetNode.visible = visible;
            console.log(`왼쪽 모델: 인덱스 기반으로 노드 찾음 - ${targetNode.name || 'unnamed'}, 가시성 변경됨 - ${visible ? '표시' : '숨김'}`);
            foundNode = true;
          }
        }
      }
      
      if (!foundNode) {
        console.warn(`왼쪽 모델: 노드 ID ${nodeId}에 해당하는 노드를 찾을 수 없음`);
        
        // 디버깅: 모델 구조 출력
        console.log('왼쪽 모델 구조:');
        let count = 0;
        model.traverse((object) => {
          if (count < 30) { // 처음 30개 노드만 출력
            console.log(`- ${object.name || 'Unnamed'} (${object.type}): ${object.uuid.substring(0, 8)}`);
            count++;
          }
        });
      }
    } catch (error) {
      console.error('왼쪽 모델: 노드 가시성 변경 중 오류 발생:', error);
    }
  }, [leftSceneRef]);
  
  const handleRightNodeVisibilityChange = useCallback((nodeId: string, visible: boolean) => {
    if (!rightSceneRef.current) return;
    console.log(`오른쪽 노드 가시성 변경 시도: ${nodeId}, 보이기: ${visible}`);
    
    // Scene 노드인 경우 (전체 씬 처리)
    if (nodeId.startsWith('scene_') && !nodeId.includes('node')) {
      if (rightSceneRef.current.children) {
        // Scene 자체가 아닌 모델만 처리 (GridHelper 등은 유지)
        const model = rightSceneRef.current.getObjectByName('exportableModel');
        if (model) {
          model.visible = visible;
          console.log(`오른쪽 모델: 전체 모델 가시성 변경됨 - ${visible ? '표시' : '숨김'}`);
        }
      }
      return;
    }
    
    // gltf-transform nodeId에서 경로 이름 추출
    try {
      // exportableModel 찾기
      const model = rightSceneRef.current.getObjectByName('exportableModel');
      if (!model) {
        console.warn('오른쪽 모델: exportableModel을 찾을 수 없음');
        return;
      }
      
      // nodeId가 scene_0_node_X_Y_Z 형식일 때 X_Y_Z 부분이 실제 계층 구조의 이름일 수 있음
      // 예: scene_0_node_1_2_3 -> Skeleton -> Hips -> Spine
      let foundNode = false;
      
      // 모든 모델의 계층 구조 순회하며 노드 이름으로 검색
      model.traverse((object) => {
        // 이미 찾았으면 더 이상 검색하지 않음
        if (foundNode) return;
        
        // 이름이 있는 노드만 처리 (익명 노드는 스킵)
        if (object.name) {
          // 전체 노드 경로 저장 (디버깅용)
          const nodePath = [];
          let current = object;
          while (current && current !== model) {
            nodePath.unshift(current.name || 'unnamed');
            current = current.parent!;
          }
          
          // 노드 ID와 계층 구조에서 이름을 기반으로 노드 찾기
          if (nodeId.includes(object.name) || 
              // 또는 노드 ID에서 추출한 숫자 인덱스로 노드 찾기
              (nodeId.match(/node_(\d+)/g) && object.name.includes(nodeId.match(/node_(\d+)/g)![0]))) {
            console.log(`오른쪽 모델: 노드를 찾음 - ${object.name}, 경로: ${nodePath.join(' -> ')}`);
            object.visible = visible;
            console.log(`오른쪽 모델: 노드 ${object.name} 가시성 변경됨 - ${visible ? '표시' : '숨김'}`);
            foundNode = true;
          }
        }
      });
      
      if (!foundNode) {
        // 인덱스 기반 탐색 시도 (scene_0_node_1_2_3 -> 1,2,3 인덱스로 찾기)
        const parts = nodeId.split('_');
        const nodeIndices: number[] = [];
        
        // '_node_' 이후의 숫자들을 인덱스로 수집
        let foundNodeKeyword = false;
        for (const part of parts) {
          if (foundNodeKeyword && !isNaN(parseInt(part))) {
            nodeIndices.push(parseInt(part));
          }
          if (part === 'node') {
            foundNodeKeyword = true;
          }
        }
        
        if (nodeIndices.length > 0) {
          console.log(`오른쪽 모델: 인덱스 기반 탐색 시도 - [${nodeIndices.join(', ')}]`);
          
          // 인덱스 경로를 따라 노드 찾기
          let targetNode = model;
          
          for (let i = 0; i < nodeIndices.length; i++) {
            const index = nodeIndices[i];
            if (targetNode.children && index < targetNode.children.length) {
              targetNode = targetNode.children[index];
            } else {
              targetNode = null;
              break;
            }
          }
          
          if (targetNode) {
            // 타깃 노드 찾음
            targetNode.visible = visible;
            console.log(`오른쪽 모델: 인덱스 기반으로 노드 찾음 - ${targetNode.name || 'unnamed'}, 가시성 변경됨 - ${visible ? '표시' : '숨김'}`);
            foundNode = true;
          }
        }
      }
      
      if (!foundNode) {
        console.warn(`오른쪽 모델: 노드 ID ${nodeId}에 해당하는 노드를 찾을 수 없음`);
        
        // 디버깅: 모델 구조 출력
        console.log('오른쪽 모델 구조:');
        let count = 0;
        model.traverse((object) => {
          if (count < 30) { // 처음 30개 노드만 출력
            console.log(`- ${object.name || 'Unnamed'} (${object.type}): ${object.uuid.substring(0, 8)}`);
            count++;
          }
        });
      }
    } catch (error) {
      console.error('오른쪽 모델: 노드 가시성 변경 중 오류 발생:', error);
    }
  }, [rightSceneRef]);

  // Scene 준비 핸들러들
  const handleLeftSceneReady = useCallback((scene: THREE.Scene) => {
    console.log("Left scene ready:", scene.uuid)
    leftSceneRef.current = scene
  }, [])

  const handleRightSceneReady = useCallback((scene: THREE.Scene) => {
    console.log("Right scene ready:", scene.uuid)  
    rightSceneRef.current = scene
  }, [])

  return (<main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8">GLTF/GLB 모델 머저</h1>

      {/* 실행 취소/다시 실행 버튼 */}
      <div className="flex justify-center gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={!canUndo}
          className="flex items-center gap-1"
        >
          <Undo2 className="h-4 w-4" />
          실행 취소
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRedo}
          disabled={!canRedo}
          className="flex items-center gap-1"
        >
          <Redo2 className="h-4 w-4" />
          다시 실행
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 왼쪽 모델 섹션 */}
        <div className="border rounded-lg p-4 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">모델 A</h2>
            <ModelDownloadButton
              scene={leftSceneRef.current}
              fileName={left.model.file?.name || "model_a"}
              disabled={!left.model.structure}
              modelStructure={left.model.structure}
              documentManager={leftDocumentManagerRef.current}
            />
          </div>

          {/* 1. 3D 렌더링 + 드롭존 통합 */}
          <div className="h-64 mb-4 border rounded">
            <ModelViewer
              initialUrl={left.model.url}
              modelStructure={left.model.structure}
              onModelLoaded={(file, structure, url, error) => {
                left.setModel({ file, structure, url, error })
                left.setVRMAFile(null)
                left.setVRMAName(null)
                historyManager.clear()
              }}
              onModelLoadComplete={(modelObject) => left.handleModelLoaded(modelObject)}
              onSceneReady={handleLeftSceneReady}
              onAnimationsLoaded={left.handleAnimationsLoaded}
              onVRMLoaded={left.handleVRMLoaded}
              onDocumentManagerReady={handleLeftDocumentManagerReady}
            />
          </div>

          {/* 2. VRMA 애니메이션 드롭존 - VRM 전용 */}
          {left.vrm ? (
            <div className="mt-3">
              <VRMADropZone
                onAnimationLoaded={left.handleVRMALoaded}
                onAnimationApply={left.handleVRMAApply}
                isVRMLoaded={!!left.vrm}
                loadedAnimationName={left.vrmaName}
                disabled={!left.vrm}
              />
            </div>
          ) : (
            /* 범용 애니메이션 드롭존 - GLB/GLTF 모델용 */
            <div className="mt-3">
              <AnimationDropZone
                onAnimationLoaded={left.handleVRMALoaded}
                onAnimationApply={left.handleVRMAApply}
                isModelLoaded={left.hasModel}
                loadedAnimationName={left.vrmaName}
                disabled={!left.hasModel}
                modelType={left.vrm ? "VRM" : "GLB"}
              />
            </div>
          )}

          {left.model.structure && (
            <div className="mt-4 flex-grow overflow-auto space-y-4">
              {/* 4. 씬 그래프 */}
              <GLTFSceneGraph
                document={leftDocumentManagerRef.current?.getDocument() || null}
                onNodeMove={async (sourceNodeId, targetNodeId) => {
                  console.log("Scene graph move:", sourceNodeId, "to", targetNodeId)
                  const document = leftDocumentManagerRef.current?.getDocument()
                  if (document && moveNodeInDocument(document, sourceNodeId, targetNodeId)) {
                    showMessage("노드 이동", "노드가 성공적으로 이동되었습니다")
                    
                    // Document 변경 후 Three.js Scene 업데이트
                    try {
                      const updatedUrl = await leftDocumentManagerRef.current?.getUpdatedModelURL()
                      if (updatedUrl) {
                        left.setModel(prev => ({ 
                          ...prev, 
                          url: updatedUrl,
                          structure: { ...prev.structure } 
                        }))
                      }
                    } catch (error) {
                      console.error("Scene 업데이트 실패:", error)
                    }
                  }
                }}
                onNodeDelete={async (nodeId) => {
                  console.log("Scene graph delete:", nodeId)
                  const document = leftDocumentManagerRef.current?.getDocument()
                  if (document && removeNodeFromDocument(document, nodeId)) {
                    showMessage("노드 삭제", "노드가 성공적으로 삭제되었습니다")
                    
                    // Document 변경 후 Three.js Scene 업데이트
                    try {
                      const updatedUrl = await leftDocumentManagerRef.current?.getUpdatedModelURL()
                      if (updatedUrl) {
                        left.setModel(prev => ({ 
                          ...prev, 
                          url: updatedUrl,
                          structure: { ...prev.structure } 
                        }))
                      }
                    } catch (error) {
                      console.error("Scene 업데이트 실패:", error)
                    }
                  }
                }}
                onNodeVisibilityChange={handleLeftNodeVisibilityChange}
                onSceneUpdate={() => {
                  console.log("Scene updated")
                }}
                side="left"
                otherSideDocument={rightDocumentManagerRef.current?.getDocument() || null}
                threeScene={leftSceneRef.current}
              />
              
              {/* 5. 모델 구조 */}
              <GLTFModelTree
                key={`left-tree-${left.model.url}-${left.model.structure?._forceUpdate || 0}`}
                document={leftDocumentManagerRef.current?.getDocument() || null}
                onNodeSelect={(nodeInfo) => {
                  console.log("Left node selected:", nodeInfo)
                }}
                onNodeMove={(sourceNodeId, targetNodeId) => {
                  console.log("Move node:", sourceNodeId, "to", targetNodeId)
                }}
                onNodeDelete={(nodeId) => {
                  console.log("Delete node:", nodeId)
                }}
                side="left"
              />
            </div>
          )}
        </div>

        {/* 오른쪽 모델 섹션 */}
        <div className="border rounded-lg p-4 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">모델 B</h2>
            <ModelDownloadButton
              scene={rightSceneRef.current}
              fileName={right.model.file?.name || "model_b"}
              disabled={!right.model.structure}
              modelStructure={right.model.structure}
              documentManager={rightDocumentManagerRef.current}
            />
          </div>

          {/* 1. 3D 렌더링 + 드롭존 통합 */}
          <div className="h-64 mb-4 border rounded">
            <ModelViewer
              initialUrl={right.model.url}
              modelStructure={right.model.structure}
              onModelLoaded={(file, structure, url, error) => {
                right.setModel({ file, structure, url, error })
                right.setVRMAFile(null)
                right.setVRMAName(null)
                historyManager.clear()
              }}
              onModelLoadComplete={(modelObject) => right.handleModelLoaded(modelObject)}
              onSceneReady={handleRightSceneReady}
              onAnimationsLoaded={right.handleAnimationsLoaded}
              onVRMLoaded={right.handleVRMLoaded}
              onDocumentManagerReady={handleRightDocumentManagerReady}
            />
          </div>

          {/* 2. VRMA 애니메이션 드롭존 - VRM 전용 */}
          {right.vrm ? (
            <div className="mt-3">
              <VRMADropZone
                onAnimationLoaded={right.handleVRMALoaded}
                onAnimationApply={right.handleVRMAApply}
                isVRMLoaded={!!right.vrm}
                loadedAnimationName={right.vrmaName}
              />
            </div>
          ) : (
            /* 범용 애니메이션 드롭존 - GLB/GLTF 모델용 */
            <div className="mt-3">
              <AnimationDropZone
                onAnimationLoaded={right.handleVRMALoaded}
                onAnimationApply={right.handleVRMAApply}
                isModelLoaded={right.hasModel}
                loadedAnimationName={right.vrmaName}
                disabled={!right.hasModel}
                modelType={right.vrm ? "VRM" : "GLB"}
              />
            </div>
          )}

          {right.model.structure && (
            <div className="mt-4 flex-grow overflow-auto space-y-4">
              {/* 4. 씬 그래프 */}
              <GLTFSceneGraph
                document={rightDocumentManagerRef.current?.getDocument() || null}
                onNodeMove={async (sourceNodeId, targetNodeId) => {
                  console.log("Scene graph move:", sourceNodeId, "to", targetNodeId)
                  const document = rightDocumentManagerRef.current?.getDocument()
                  if (document && moveNodeInDocument(document, sourceNodeId, targetNodeId)) {
                    showMessage("노드 이동", "노드가 성공적으로 이동되었습니다")
                    
                    // Document 변경 후 Three.js Scene 업데이트
                    try {
                      const updatedUrl = await rightDocumentManagerRef.current?.getUpdatedModelURL()
                      if (updatedUrl) {
                        right.setModel(prev => ({ 
                          ...prev, 
                          url: updatedUrl,
                          structure: { ...prev.structure } 
                        }))
                      }
                    } catch (error) {
                      console.error("Scene 업데이트 실패:", error)
                    }
                  }
                }}
                onNodeDelete={async (nodeId) => {
                  console.log("Scene graph delete:", nodeId)
                  const document = rightDocumentManagerRef.current?.getDocument()
                  if (document && removeNodeFromDocument(document, nodeId)) {
                    showMessage("노드 삭제", "노드가 성공적으로 삭제되었습니다")
                    
                    // Document 변경 후 Three.js Scene 업데이트
                    try {
                      const updatedUrl = await rightDocumentManagerRef.current?.getUpdatedModelURL()
                      if (updatedUrl) {
                        right.setModel(prev => ({ 
                          ...prev, 
                          url: updatedUrl,
                          structure: { ...prev.structure } 
                        }))
                      }
                    } catch (error) {
                      console.error("Scene 업데이트 실패:", error)
                    }
                  }
                }}
                onNodeVisibilityChange={handleRightNodeVisibilityChange}
                onSceneUpdate={() => {
                  console.log("Scene updated")
                }}
                side="right"
                otherSideDocument={leftDocumentManagerRef.current?.getDocument() || null}
                threeScene={rightSceneRef.current}
              />
              
              {/* 5. 모델 구조 */}
              <GLTFModelTree
                key={`right-tree-${right.model.url}-${right.model.structure?._forceUpdate || 0}`}
                document={rightDocumentManagerRef.current?.getDocument() || null}
                onNodeSelect={(nodeInfo) => {
                  console.log("Right node selected:", nodeInfo)
                }}
                onNodeMove={(sourceNodeId, targetNodeId) => {
                  console.log("Move node:", sourceNodeId, "to", targetNodeId)
                }}
                onNodeDelete={(nodeId) => {
                  console.log("Delete node:", nodeId)
                }}
                side="right"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
