"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ModelDropZone } from "@/components/model-drop-zone"
import { ModelViewer } from "@/components/model-viewer"
import { GLTFModelTree } from "@/components/gltf-model-tree"
import { GLTFSceneGraph } from "@/components/gltf-scene-graph"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Undo2, Redo2 } from "lucide-react"

import { type GLTFNodeInfo, moveNodeInDocument, copyNodeInDocument, removeNodeFromDocument } from "@/lib/gltf-transform-utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HistoryManager } from "@/lib/history-manager"
import { ModelDownloadButton } from "@/components/model-download-button"
import { VRMADropZone } from "@/components/vrma-drop-zone"
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

  const [clipboard, setClipboard] = useState<{
    nodeInfo: GLTFNodeInfo | null
    source: "left" | "right" | null
  }>({
    nodeInfo: null,
    source: null,
  })

  // 히스토리 상태 추가
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
    console.log("🟢 [PAGE] Left DocumentManager ready and saved:", manager)
  }, [])

  const handleRightDocumentManagerReady = useCallback((manager: any) => {
    rightDocumentManagerRef.current = manager
    console.log("🟢 [PAGE] Right DocumentManager ready and saved:", manager)
  }, [])

  // Scene 준비 핸들러들
  const handleLeftSceneReady = useCallback((scene: THREE.Scene) => {
    console.log("Left scene ready:", scene.uuid)
    leftSceneRef.current = scene
  }, [])

  const handleRightSceneReady = useCallback((scene: THREE.Scene) => {
    console.log("Right scene ready:", scene.uuid)  
    rightSceneRef.current = scene
  }, [])

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8">VRM/GLB 모델 머저</h1>

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
              vrmData={left.vrm?.userData}
              isVRM={!!left.vrm}
              documentManager={leftDocumentManagerRef.current}
            />
          </div>

          <ModelDropZone
            onModelLoaded={(file, structure, url, error) => {
              left.setModel({ file, structure, url, error })
              left.setVRMAFile(null)
              left.setVRMAName(null)
              historyManager.clear()
            }}
          />

          <div className="mt-3">
            <VRMADropZone
              onAnimationLoaded={left.handleVRMALoaded}
              onAnimationApply={left.handleVRMAApply}
              isVRMLoaded={!!left.vrm}
              loadedAnimationName={left.vrmaName}
              disabled={!left.vrm}
            />
          </div>

          {left.model.structure && (
            <div className="mt-4 flex-grow overflow-auto space-y-4">
              <GLTFModelTree
                document={leftDocumentManagerRef.current?.getDocument() || null}
                onNodeSelect={(nodeInfo) => {
                  console.log("Left node selected:", nodeInfo)
                }}
                onNodeCopy={(nodeInfo) => {
                  setClipboard({ nodeInfo, source: "left" })
                }}
                onNodeMove={(sourceNodeId, targetNodeId) => {
                  console.log("Move node:", sourceNodeId, "to", targetNodeId)
                }}
                onNodeDelete={(nodeId) => {
                  console.log("Delete node:", nodeId)
                }}
                side="left"
                clipboard={clipboard}
              />
              
              <GLTFSceneGraph
                document={leftDocumentManagerRef.current?.getDocument() || null}
                onNodeMove={(sourceNodeId, targetNodeId) => {
                  console.log("Scene graph move:", sourceNodeId, "to", targetNodeId)
                  const document = leftDocumentManagerRef.current?.getDocument()
                  if (document && moveNodeInDocument(document, sourceNodeId, targetNodeId)) {
                    showMessage("노드 이동", "노드가 성공적으로 이동되었습니다")
                    left.setModel(prev => ({ ...prev, structure: { ...prev.structure } }))
                  }
                }}
                onNodeCopy={(sourceNodeId, targetNodeId) => {
                  console.log("Scene graph copy:", sourceNodeId, "to", targetNodeId)
                  const document = leftDocumentManagerRef.current?.getDocument()
                  if (document && copyNodeInDocument(document, sourceNodeId, targetNodeId)) {
                    showMessage("노드 복사", "노드가 성공적으로 복사되었습니다")
                    left.setModel(prev => ({ ...prev, structure: { ...prev.structure } }))
                  }
                }}
                onNodeDelete={(nodeId) => {
                  console.log("Scene graph delete:", nodeId)
                  const document = leftDocumentManagerRef.current?.getDocument()
                  if (document && removeNodeFromDocument(document, nodeId)) {
                    showMessage("노드 삭제", "노드가 성공적으로 삭제되었습니다")
                    left.setModel(prev => ({ ...prev, structure: { ...prev.structure } }))
                  }
                }}
                onSceneUpdate={() => {
                  console.log("Scene updated")
                }}
                side="left"
                otherSideDocument={rightDocumentManagerRef.current?.getDocument() || null}
                clipboard={clipboard}
                onClipboardChange={setClipboard}
              />
            </div>
          )}

          <div className="h-64 mt-4 border rounded">
            {left.model.url ? (
              left.model.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>모델 로딩 실패</AlertTitle>
                  <AlertDescription>{left.model.error}</AlertDescription>
                </Alert>
              ) : (
                <ModelViewer
                  url={left.model.url}
                  modelStructure={left.model.structure}
                  onSceneReady={handleLeftSceneReady}
                  onAnimationsLoaded={left.handleAnimationsLoaded}
                  onVRMLoaded={left.handleVRMLoaded}
                  onDocumentManagerReady={handleLeftDocumentManagerReady}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                모델을 로드하면 여기에 표시됩니다
              </div>
            )}
          </div>
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
              vrmData={right.vrm?.userData}
              isVRM={!!right.vrm}
              documentManager={rightDocumentManagerRef.current}
            />
          </div>

          <ModelDropZone
            onModelLoaded={(file, structure, url, error) => {
              right.setModel({ file, structure, url, error })
              right.setVRMAFile(null)
              right.setVRMAName(null)
              historyManager.clear()
            }}
          />

          <div className="mt-3">
            <VRMADropZone
              onAnimationLoaded={right.handleVRMALoaded}
              onAnimationApply={right.handleVRMAApply}
              isVRMLoaded={!!right.vrm}
              loadedAnimationName={right.vrmaName}
            />
          </div>

          {right.model.structure && (
            <div className="mt-4 flex-grow overflow-auto space-y-4">
              <GLTFModelTree
                document={rightDocumentManagerRef.current?.getDocument() || null}
                onNodeSelect={(nodeInfo) => {
                  console.log("Right node selected:", nodeInfo)
                }}
                onNodeCopy={(nodeInfo) => {
                  setClipboard({ nodeInfo, source: "right" })
                }}
                onNodeMove={(sourceNodeId, targetNodeId) => {
                  console.log("Move node:", sourceNodeId, "to", targetNodeId)
                }}
                onNodeDelete={(nodeId) => {
                  console.log("Delete node:", nodeId)
                }}
                side="right"
                clipboard={clipboard}
              />
              
              <GLTFSceneGraph
                document={rightDocumentManagerRef.current?.getDocument() || null}
                onNodeMove={(sourceNodeId, targetNodeId) => {
                  console.log("Scene graph move:", sourceNodeId, "to", targetNodeId)
                  const document = rightDocumentManagerRef.current?.getDocument()
                  if (document && moveNodeInDocument(document, sourceNodeId, targetNodeId)) {
                    showMessage("노드 이동", "노드가 성공적으로 이동되었습니다")
                    right.setModel(prev => ({ ...prev, structure: { ...prev.structure } }))
                  }
                }}
                onNodeCopy={(sourceNodeId, targetNodeId) => {
                  console.log("Scene graph copy:", sourceNodeId, "to", targetNodeId)
                  const document = rightDocumentManagerRef.current?.getDocument()
                  if (document && copyNodeInDocument(document, sourceNodeId, targetNodeId)) {
                    showMessage("노드 복사", "노드가 성공적으로 복사되었습니다")
                    right.setModel(prev => ({ ...prev, structure: { ...prev.structure } }))
                  }
                }}
                onNodeDelete={(nodeId) => {
                  console.log("Scene graph delete:", nodeId)
                  const document = rightDocumentManagerRef.current?.getDocument()
                  if (document && removeNodeFromDocument(document, nodeId)) {
                    showMessage("노드 삭제", "노드가 성공적으로 삭제되었습니다")
                    right.setModel(prev => ({ ...prev, structure: { ...prev.structure } }))
                  }
                }}
                onSceneUpdate={() => {
                  console.log("Scene updated")
                }}
                side="right"
                otherSideDocument={leftDocumentManagerRef.current?.getDocument() || null}
                clipboard={clipboard}
                onClipboardChange={setClipboard}
              />
            </div>
          )}

          <div className="h-64 mt-4 border rounded">
            {right.model.url ? (
              right.model.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>모델 로딩 실패</AlertTitle>
                  <AlertDescription>{right.model.error}</AlertDescription>
                </Alert>
              ) : (
                <ModelViewer
                  url={right.model.url}
                  modelStructure={right.model.structure}
                  onSceneReady={handleRightSceneReady}
                  onAnimationsLoaded={right.handleAnimationsLoaded}
                  onVRMLoaded={right.handleVRMLoaded}
                  onDocumentManagerReady={handleRightDocumentManagerReady}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                모델을 로드하면 여기에 표시됩니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 클립보드 상태 표시 */}
      <div className="col-span-1 md:col-span-2 flex justify-center items-center gap-4 my-4">
        {clipboard.nodeInfo && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
            <span className="text-sm font-medium">클립보드:</span>
            <Badge variant="outline">
              {clipboard.nodeInfo.name} ({clipboard.nodeInfo.type})
            </Badge>
            <span className="text-xs text-muted-foreground">
              {clipboard.source === "left" ? "모델 A → 모델 B" : "모델 B → 모델 A"}
            </span>
          </div>
        )}
        
        {clipboard.nodeInfo && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClipboard({ nodeInfo: null, source: null })
            }}
            className="text-gray-600"
          >
            클립보드 비우기
          </Button>
        )}
      </div>

    </main>
  )
}
