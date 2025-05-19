"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ModelDropZone } from "@/components/model-drop-zone"
import { ModelViewer } from "@/components/model-viewer"
import { ModelTree } from "@/components/model-tree"
import { SceneGraphTree } from "@/components/scene-graph-tree"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Undo2, Redo2 } from "lucide-react"

// 상단에 import 추가
import { createPasteResult, deleteNodeFromStructure } from "@/lib/model-utils"
import { Button } from "@/components/ui/button"
import { HistoryManager } from "@/lib/history-manager"
import { ModelDownloadButton } from "@/components/model-download-button"
import * as THREE from "three"

// 간단한 toast 대체 함수
const showMessage = (title: string, description: string, type: "success" | "error" = "success") => {
  console.log(`${title}: ${description}`)
  // 개발 중에는 console.log로 대체
}

// MemoizedToaster 제거

export default function Home() {
  const [leftModel, setLeftModel] = useState<{
    file: File | null
    structure: any
    url: string | null
    error: string | null
  }>({
    file: null,
    structure: null,
    url: null,
    error: null,
  })

  const [rightModel, setRightModel] = useState<{
    file: File | null
    structure: any
    url: string | null
    error: string | null
  }>({
    file: null,
    structure: null,
    url: null,
    error: null,
  })

  const [clipboard, setClipboard] = useState<{
    data: any
    source: "left" | "right" | null
  }>({
    data: null,
    source: null,
  })

  // useState 부분에 pasteMode 상태 추가
  const [pasteMode, setPasteMode] = useState<"add" | "replace">("add")

  // 히스토리 매니저 추가
  const [historyManager] = useState(() => new HistoryManager(50))
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // 씬 참조 추가
  const leftSceneRef = useRef<THREE.Scene | null>(null)
  const rightSceneRef = useRef<THREE.Scene | null>(null)

  // Scene 상태 (리렌더링 트리거용)
  const [leftScene, setLeftScene] = useState<THREE.Scene | null>(null)
  const [rightScene, setRightScene] = useState<THREE.Scene | null>(null)

  // Scene Graph용 클립보드 (Three.js Object3D 기반)
  const [sceneClipboard, setSceneClipboard] = useState<{
    object: THREE.Object3D | null
    source: "left" | "right" | null
  }>({
    object: null,
    source: null,
  })

  // 씬 변경 핸들러들 - 안정화
  const handleLeftSceneChange = useCallback((scene: THREE.Scene) => {
    if (leftSceneRef.current !== scene) {
      leftSceneRef.current = scene
      setLeftScene(scene)
      console.log("Left scene updated:", scene.uuid)
    }
  }, [])

  const handleRightSceneChange = useCallback((scene: THREE.Scene) => {
    if (rightSceneRef.current !== scene) {
      rightSceneRef.current = scene
      setRightScene(scene)
      console.log("Right scene updated:", scene.uuid)
    }
  }, [])

  // 컴포넌트 내부에서 toast 제거

  // 히스토리 상태 업데이트
  useEffect(() => {
    setCanUndo(historyManager.canUndo())
    setCanRedo(historyManager.canRedo())
  }, [leftModel, rightModel, historyManager])

  // 실행 취소 함수
  const handleUndo = () => {
    const action = historyManager.undo()
    if (!action) return

    if (action.targetSide === "left") {
      setLeftModel((prev) => ({ ...prev, structure: action.prevState }))
    } else {
      setRightModel((prev) => ({ ...prev, structure: action.prevState }))
    }

    showMessage("실행 취소", action.description)
  }

  // 다시 실행 함수
  const handleRedo = () => {
    const action = historyManager.redo()
    if (!action) return

    if (action.targetSide === "left") {
      setLeftModel((prev) => ({ ...prev, structure: action.newState }))
    } else {
      setRightModel((prev) => ({ ...prev, structure: action.newState }))
    }

    showMessage("다시 실행", action.description)
  }

  // 왼쪽 모델 삭제 핸들러
  const handleLeftDelete = (path: string[]) => {
    if (!leftModel.structure) return

    const prevState = leftModel.structure
    const result = deleteNodeFromStructure(leftModel.structure, path)

    if (result.success) {
      // 히스토리에 작업 추가
      historyManager.addAction({
        type: "delete",
        targetSide: "left",
        path,
        prevState,
        newState: result.result,
        description: `모델 A에서 '${path[path.length - 1] || "root"}' 노드 삭제`,
      })

      setLeftModel({ ...leftModel, structure: result.result })
      showMessage("노드 삭제", result.message)
    } else {
      showMessage("삭제 실패", result.message, "error")
    }
  }

  // 오른쪽 모델 삭제 핸들러
  const handleRightDelete = (path: string[]) => {
    if (!rightModel.structure) return

    const prevState = rightModel.structure
    const result = deleteNodeFromStructure(rightModel.structure, path)

    if (result.success) {
      // 히스토리에 작업 추가
      historyManager.addAction({
        type: "delete",
        targetSide: "right",
        path,
        prevState,
        newState: result.result,
        description: `모델 B에서 '${path[path.length - 1] || "root"}' 노드 삭제`,
      })

      setRightModel({ ...rightModel, structure: result.result })
      showMessage("노드 삭제", result.message)
    } else {
      showMessage("삭제 실패", result.message, "error")
    }
  }

  // 왼쪽 씬 준비 핸들러 - 안정화
  const handleLeftSceneReady = useCallback((scene: THREE.Scene) => {
    console.log("Left scene ready:", scene.uuid)
    handleLeftSceneChange(scene)
  }, [handleLeftSceneChange])

  // 오른쪽 씬 준비 핸들러 - 안정화
  const handleRightSceneReady = useCallback((scene: THREE.Scene) => {
    console.log("Right scene ready:", scene.uuid)
    handleRightSceneChange(scene)
  }, [handleRightSceneChange])

  // 왼쪽 모델 애니메이션 로드 핸들러
  const handleLeftAnimationsLoaded = useCallback((animations: THREE.AnimationClip[]) => {
    console.log("왼쪽 모델 애니메이션 로드됨:", animations.length)
    setLeftModel(prev => ({
      ...prev,
      structure: {
        ...prev.structure,
        animations: animations
      }
    }))
  }, [])

  // 오른쪽 모델 애니메이션 로드 핸들러
  const handleRightAnimationsLoaded = useCallback((animations: THREE.AnimationClip[]) => {
    console.log("오른쪽 모델 애니메이션 로드됨:", animations.length)
    setRightModel(prev => ({
      ...prev,
      structure: {
        ...prev.structure,
        animations: animations
      }
    }))
  }, [])

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8">VRM/GLB 모델 머저</h1>

      {/* 실행 취소/다시 실행 버튼 추가 */}
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

            {/* 다운로드 버튼 추가 */}
            <ModelDownloadButton
              scene={leftSceneRef.current}
              fileName={leftModel.file?.name || "model_a.glb"}
              disabled={!leftModel.structure}
              modelStructure={leftModel.structure}
            />
          </div>

          <ModelDropZone
            onModelLoaded={(file, structure, url, error) => {
              setLeftModel({ file, structure, url, error })
              // 씬 객체는 그대로 두고, 기존 씬의 children만 모두 정리(시스템 객체 제외)는 model-viewer.tsx에서 처리
              // 새 모델 로드 시 히스토리 초기화
              historyManager.clear()
            }}
          />

          {leftModel.structure && (
            <div className="mt-4 flex-grow overflow-auto space-y-4">
              {/* 기존 모델 구조 트리 */}
              <ModelTree
                structure={leftModel.structure}
                onCopy={(data) => setClipboard({ data, source: "left" })}
                onPaste={(path) => {
                  if (clipboard.data && clipboard.source === "right") {
                    const prevState = leftModel.structure
                    const result = createPasteResult(clipboard.data, leftModel.structure, path, pasteMode)

                    if (result.success) {
                      historyManager.addAction({
                        type: "paste",
                        targetSide: "left",
                        path,
                        prevState,
                        newState: result.result,
                        description: `모델 B에서 모델 A로 '${clipboard.data.path[clipboard.data.path.length - 1] || "root"}' 노드 붙여넣기`,
                      })

                      // 애니메이션 노드 복사/붙여넣기 지원
                      if (clipboard.data.type === "animation" && clipboard.data.animation) {
                        let anim = clipboard.data.animation;
                        // AnimationClip이 인스턴스가 아니면 변환
                        if (!(anim instanceof THREE.AnimationClip)) {
                          anim = new THREE.AnimationClip(
                            anim.name,
                            anim.duration,
                            anim.tracks?.map(track =>
                              // track이 인스턴스가 아니면 변환
                              (track && track.constructor && track.constructor.name !== "KeyframeTrack")
                                ? new THREE.KeyframeTrack(track.name, track.times, track.values, track.interpolation)
                                : track
                            ) || []
                          );
                        }
                        setLeftModel({
                          ...leftModel,
                          structure: {
                            ...result.result,
                            animations: [
                              ...(result.result.animations || []),
                              anim
                            ]
                          }
                        })
                        showMessage("애니메이션 붙여넣기 성공", result.message)
                      } else {
                        setLeftModel({ ...leftModel, structure: result.result })
                        showMessage("붙여넣기 성공", result.message)
                      }
                    } else {
                      showMessage("붙여넣기 실패", result.message, "error")
                    }
                  }
                }}
                onDelete={handleLeftDelete}
                side="left"
                otherSideHasData={!!rightModel.structure}
                clipboard={clipboard}
              />
              
              {/* Scene Graph 트리 */}
              <SceneGraphTree
                scene={leftScene}
                onSceneChange={handleLeftSceneChange}
                side="left"
                otherSideScene={rightScene}
                clipboard={sceneClipboard}
                onClipboardChange={setSceneClipboard}
              />
            </div>
          )}

          <div className="h-64 mt-4 border rounded">
            {leftModel.url ? (
              leftModel.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>모델 로딩 실패</AlertTitle>
                  <AlertDescription>{leftModel.error}</AlertDescription>
                </Alert>
              ) : (
                <ModelViewer
                  url={leftModel.url}
                  modelStructure={leftModel.structure}
                  onSceneReady={handleLeftSceneReady}
                  onAnimationsLoaded={handleLeftAnimationsLoaded}
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

            {/* 다운로드 버튼 추가 */}
            <ModelDownloadButton
              scene={rightSceneRef.current}
              fileName={rightModel.file?.name || "model_b.glb"}
              disabled={!rightModel.structure}
              modelStructure={rightModel.structure}
            />
          </div>

          <ModelDropZone
            onModelLoaded={(file, structure, url, error) => {
              setRightModel({ file, structure, url, error })
              // 씬 객체는 그대로 두고, 기존 씬의 children만 모두 정리(시스템 객체 제외)는 model-viewer.tsx에서 처리
              // 새 모델 로드 시 히스토리 초기화
              historyManager.clear()
            }}
          />

          {rightModel.structure && (
            <div className="mt-4 flex-grow overflow-auto space-y-4">
              {/* 기존 모델 구조 트리 */}
              <ModelTree
                structure={rightModel.structure}
                onCopy={(data) => setClipboard({ data, source: "right" })}
                onPaste={(path) => {
                  if (clipboard.data && clipboard.source === "left") {
                    const prevState = rightModel.structure
                    const result = createPasteResult(clipboard.data, rightModel.structure, path, pasteMode)

                    if (result.success) {
                      historyManager.addAction({
                        type: "paste",
                        targetSide: "right",
                        path,
                        prevState,
                        newState: result.result,
                        description: `모델 A에서 모델 B로 '${clipboard.data.path[clipboard.data.path.length - 1] || "root"}' 노드 붙여넣기`,
                      })

                      setRightModel({ ...rightModel, structure: result.result })
                      showMessage("붙여넣기 성공", result.message)
                    } else {
                      showMessage("붙여넣기 실패", result.message, "error")
                    }
                  }
                }}
                onDelete={handleRightDelete}
                side="right"
                otherSideHasData={!!leftModel.structure}
                clipboard={clipboard}
              />
              
              {/* Scene Graph 트리 */}
              <SceneGraphTree
                scene={rightScene}
                onSceneChange={handleRightSceneChange}
                side="right"
                otherSideScene={leftScene}
                clipboard={sceneClipboard}
                onClipboardChange={setSceneClipboard}
              />
            </div>
          )}

          <div className="h-64 mt-4 border rounded">
            {rightModel.url ? (
              rightModel.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>모델 로딩 실패</AlertTitle>
                  <AlertDescription>{rightModel.error}</AlertDescription>
                </Alert>
              ) : (
                <ModelViewer
                  url={rightModel.url}
                  modelStructure={rightModel.structure}
                  onSceneReady={handleRightSceneReady}
                  onAnimationsLoaded={handleRightAnimationsLoaded}
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

      {/* 붙여넣기 모드 선택 UI 및 클립보드 상태 표시 */}
      <div className="col-span-1 md:col-span-2 flex justify-center items-center gap-4 my-4">
        {/* JSON 기반 클립보드 상태 */}
        {clipboard.data && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
            <span className="text-sm font-medium">모델 구조 클립보드:</span>
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${
                  pasteMode === "add" ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
                onClick={() => setPasteMode("add")}
              >
                추가
              </button>
              <button
                className={`px-3 py-1 text-sm ${
                  pasteMode === "replace" ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
                onClick={() => setPasteMode("replace")}
              >
                대체
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {clipboard.source === "left" ? "모델 A → 모델 B" : "모델 B → 모델 A"}
            </span>
          </div>
        )}
        
        {/* Scene Graph 클립보드 상태 */}
        {sceneClipboard.object && (
          <div className="flex items-center gap-2 p-2 bg-blue-100 rounded-md">
            <span className="text-sm font-medium">Scene Graph 클립보드:</span>
            <span className="text-xs px-2 py-1 bg-blue-200 rounded">
              {sceneClipboard.object.name || sceneClipboard.object.type}
            </span>
            <span className="text-xs text-blue-600">
              {sceneClipboard.source === "left" ? "씬 A → 씬 B" : "씬 B → 씬 A"}
            </span>
          </div>
        )}
        
        {/* 클립보드 비우기 버튼 */}
        {(clipboard.data || sceneClipboard.object) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClipboard({ data: null, source: null })
              setSceneClipboard({ object: null, source: null })
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
