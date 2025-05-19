"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { ChevronRight, ChevronDown, Copy, Clipboard, Check, Trash2, Eye, EyeOff, Search, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import * as THREE from "three"
import {
  findObjectInScene,
  getObjectPath,
  NodeSearcher,
  copyObjectToParent,
  moveObjectToParent,
  removeObjectFromScene,
} from "@/lib/three-scene-utils"

interface SceneGraphTreeProps {
  scene: THREE.Scene | null
  onSceneChange?: (scene: THREE.Scene) => void
  onNodeSelect?: (object: THREE.Object3D | null) => void
  side: "left" | "right"
  otherSideScene?: THREE.Scene | null
  clipboard?: {
    object: THREE.Object3D | null
    source: "left" | "right" | null
  }
  onClipboardChange?: (data: { object: THREE.Object3D | null; source: "left" | "right" | null }) => void
}

/**
 * Scene Graph 전용 트리 컴포넌트
 * Three.js 씬 그래프를 직접적으로 표시하고 조작
 */
export function SceneGraphTree({
  scene,
  onSceneChange,
  onNodeSelect,
  side,
  otherSideScene,
  clipboard,
  onClipboardChange
}: SceneGraphTreeProps) {
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<THREE.Object3D[]>([])
  const [filterType, setFilterType] = useState<string>("all")
  const [showInvisible, setShowInvisible] = useState(true)
  const [showSystemObjects, setShowSystemObjects] = useState(false)
  
  const searcherRef = useRef<NodeSearcher | null>(null)
  
  // 시스템 객체인지 확인 (useCallback으로 메모이제이션)
  const isSystemObject = useCallback((object: THREE.Object3D): boolean => {
    return object.type === "DirectionalLight" || 
           object.type === "AmbientLight" || 
           object.type === "GridHelper" ||
           object.type === "HemisphereLight" ||
           object.type === "PointLight" ||
           object.type === "SpotLight"
  }, [])
  
  // 노드가 다른 노드의 후손인지 확인 (useCallback으로 메모이제이션)
  const isDescendant = useCallback((ancestor: THREE.Object3D, descendant: THREE.Object3D): boolean => {
    let current: THREE.Object3D | null = descendant.parent
    while (current) {
      if (current === ancestor) return true
      current = current.parent
    }
    return false
  }, [])
  
  // 노드가 표시되어야 하는지 확인하는 함수 (일반 함수로 변경)
  const shouldShowNode = (object: THREE.Object3D): boolean => {
    // 시스템 객체 필터링
    if (!showSystemObjects && isSystemObject(object)) return false
    
    // 보이지 않는 노드 필터링
    if (!showInvisible && !object.visible) return false
    
    // 타입 필터링
    if (filterType !== "all") {
      if (filterType === "mesh" && !(object instanceof THREE.Mesh)) return false
      if (filterType === "group" && object.type !== "Group") return false
      if (filterType === "bone" && object.type !== "Bone") return false
      if (filterType === "light" && !(object as any).isLight) return false
      if (filterType === "camera" && !(object instanceof THREE.Camera)) return false
    }
    
    // 검색 결과 필터링
    if (searchResults.length > 0) {
      return searchResults.includes(object) || 
             searchResults.some(result => isDescendant(object, result)) ||
             searchResults.some(result => isDescendant(result, object))
    }
    
    return true
  }

  // 씬이 변경될 때 초기화 - 안정화
  useEffect(() => {
    console.log("SceneGraphTree: Scene 변경됨", scene?.uuid)
    if (scene) {
      // Scene 참조를 안정적으로 저장
      if (!searcherRef.current || searcherRef.current.scene !== scene) {
        searcherRef.current = new NodeSearcher(scene)
        console.log("SceneGraphTree: NodeSearcher 생성됨", scene.uuid)
      }
      
      // Scene UUID를 기반으로 펼쳐진 노드 초기화
      setExpandedNodes(new Set([scene.uuid]))
      console.log("SceneGraphTree: 자식 노드 수", scene.children.length)
    } else {
      searcherRef.current = null
      setExpandedNodes(new Set())
      console.log("SceneGraphTree: Scene이 null입니다")
    }
  }, [scene?.uuid]) // scene 객체 대신 uuid만 의존성으로 사용
  
  // 검색 기능 - 안정화
  useEffect(() => {
    if (searchQuery && searcherRef.current) {
      const results = searcherRef.current.searchByName(searchQuery, false)
      setSearchResults(results)
      
      // 검색 결과의 부모 노드들을 자동으로 펼쳐줌 (expandedNodes를 직접 업데이트하지 않음)
      if (results.length > 0) {
        const pathsToExpand = new Set(expandedNodes)
        let hasChanges = false
        
        results.forEach(obj => {
          let current = obj.parent
          while (current && current !== scene) {
            if (!pathsToExpand.has(current.uuid)) {
              pathsToExpand.add(current.uuid)
              hasChanges = true
            }
            current = current.parent
          }
        })
        
        if (hasChanges) {
          setExpandedNodes(pathsToExpand)
        }
      }
    } else {
      setSearchResults([])
    }
  }, [searchQuery, scene?.uuid]) // scene 대신 scene?.uuid 사용
  
  // 노드 펼치기/접기
  const toggleExpanded = (uuid: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(uuid)) {
      newExpanded.delete(uuid)
    } else {
      newExpanded.add(uuid)
    }
    setExpandedNodes(newExpanded)
  }
  
  // 노드 선택
  const handleNodeSelect = (object: THREE.Object3D) => {
    setSelectedUuid(object.uuid)
    if (onNodeSelect) {
      onNodeSelect(object)
    }
  }
  
  // 노드 복사
  const handleCopy = (object: THREE.Object3D) => {
    if (onClipboardChange) {
      onClipboardChange({ object, source: side })
    }
  }
  
  // 노드 붙여넣기 (Cross Scene Graph)
  const handlePaste = (targetObject: THREE.Object3D) => {
    if (!clipboard?.object || !scene) return
    
    // 같은 쪽에서는 붙여넣기 불가
    if (clipboard.source === side) return
    
    // 순환 참조 방지 - 자기 자신이나 후손에게는 붙여넣기 불가
    if (clipboard.object === targetObject || isDescendant(clipboard.object, targetObject)) {
      console.warn("순환 참조가 발생하여 붙여넣기를 취소합니다.")
      return
    }
    
    const result = copyObjectToParent(clipboard.object, targetObject)
    if (result.success && onSceneChange) {
      onSceneChange(scene)
      console.log(`Scene Graph: ${clipboard.object.name || clipboard.object.uuid} → ${targetObject.name || targetObject.uuid}`)
    }
  }
  
  // 노드 이동 (같은 Scene Graph 내에서)
  const handleMove = (object: THREE.Object3D, newParent: THREE.Object3D) => {
    if (!scene) return
    
    const result = moveObjectToParent(object, newParent)
    if (result.success && onSceneChange) {
      onSceneChange(scene)
      console.log(`Scene Graph 내 이동: ${object.name || object.uuid} → ${newParent.name || newParent.uuid}`)
    }
  }
  
  // 노드 삭제
  const handleDelete = (object: THREE.Object3D) => {
    if (!scene) return
    
    // 시스템 객체 삭제 방지
    if (isSystemObject(object)) {
      console.warn("시스템 객체는 삭제할 수 없습니다.")
      return
    }
    
    const result = removeObjectFromScene(object)
    if (result.success && onSceneChange) {
      onSceneChange(scene)
      
      // 선택된 노드가 삭제된 경우 선택 해제
      if (selectedUuid === object.uuid) {
        setSelectedUuid(null)
        if (onNodeSelect) {
          onNodeSelect(null)
        }
      }
      console.log(`Scene Graph에서 삭제: ${object.name || object.uuid}`)
    }
  }
  
  // 노드 가시성 토글
  const toggleVisibility = (object: THREE.Object3D) => {
    object.visible = !object.visible
    if (onSceneChange) {
      onSceneChange(scene!)
    }
  }
  
  if (!scene) {
    return (
      <div className="border rounded p-3 text-center text-gray-500">
        모델을 로드하면 Scene Graph가 표시됩니다
      </div>
    )
  }
  
  return (
    <TooltipProvider>
      <div className="border rounded p-3">
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Scene Graph</h3>
            <Badge variant="outline" className="text-xs">
              Three.js
            </Badge>
          </div>
          
          {/* 검색 및 필터 */}
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Scene Graph 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="w-20 h-8 px-2 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="all">전체</option>
              <option value="mesh">Mesh</option>
              <option value="group">Group</option>
              <option value="bone">Bone</option>
              <option value="light">Light</option>
              <option value="camera">Camera</option>
            </select>
          </div>
          
          {/* 옵션 토글 */}
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showInvisible}
                onChange={(e) => setShowInvisible(e.target.checked)}
                className="w-3 h-3"
              />
              숨겨진 객체
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showSystemObjects}
                onChange={(e) => setShowSystemObjects(e.target.checked)}
                className="w-3 h-3"
              />
              시스템 객체
            </label>
          </div>
          
          {searchResults.length > 0 && (
            <div className="text-sm text-blue-600">
              검색 결과: {searchResults.length}개
            </div>
          )}
          
          {/* Scene Graph 통계 */}
          <div className="text-xs text-gray-500">
            총 객체: {scene.children.length}개
            {clipboard?.object && (
              <span className="ml-2 text-blue-600">
                • 클립보드: {clipboard.object.name || clipboard.object.type}
              </span>
            )}
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-auto">
          {/* Scene 루트 노드 */}
          <SceneGraphNode
            object={scene}
            isExpanded={expandedNodes.has(scene.uuid)}
            isSelected={selectedUuid === scene.uuid}
            isInSearchResults={searchResults.includes(scene)}
            hasClipboardData={!!clipboard?.object}
            canPaste={clipboard?.source !== side}
            onToggleExpanded={() => toggleExpanded(scene.uuid)}
            onSelect={() => handleNodeSelect(scene)}
            onCopy={() => handleCopy(scene)}
            onPaste={() => {}} // Scene 자체에는 붙여넣기 불가
            onMove={handleMove}
            onDelete={() => {}} // Scene 자체는 삭제 불가
            onToggleVisibility={() => {}} // Scene 자체의 가시성은 조절 불가
            shouldShowNode={shouldShowNode}
            expandedNodes={expandedNodes}
            selectedUuid={selectedUuid}
            searchResults={searchResults}
            clipboard={clipboard}
            side={side}
            onNodeSelect={onNodeSelect}
            onClipboardChange={onClipboardChange}
            onSceneChange={onSceneChange}
            scene={scene}
            isSystemObject={isSystemObject}
            toggleExpanded={toggleExpanded}
            handleNodeSelect={handleNodeSelect}
            handleCopy={handleCopy}
            handlePaste={handlePaste}
            handleMove={handleMove}
            handleDelete={handleDelete}
            toggleVisibility={toggleVisibility}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}

interface SceneGraphNodeProps {
  object: THREE.Object3D
  isExpanded: boolean
  isSelected: boolean
  isInSearchResults: boolean
  hasClipboardData: boolean
  canPaste: boolean
  onToggleExpanded: () => void
  onSelect: () => void
  onCopy: () => void
  onPaste: () => void
  onMove: (object: THREE.Object3D, newParent: THREE.Object3D) => void
  onDelete: () => void
  onToggleVisibility: () => void
  shouldShowNode: (object: THREE.Object3D) => boolean
  expandedNodes: Set<string>
  selectedUuid: string | null
  searchResults: THREE.Object3D[]
  clipboard?: { object: THREE.Object3D | null; source: "left" | "right" | null }
  side: "left" | "right"
  onNodeSelect?: (object: THREE.Object3D | null) => void
  onClipboardChange?: (data: { object: THREE.Object3D | null; source: "left" | "right" | null }) => void
  onSceneChange?: (scene: THREE.Scene) => void
  scene: THREE.Scene
  isSystemObject: (object: THREE.Object3D) => boolean
  toggleExpanded: (uuid: string) => void
  handleNodeSelect: (object: THREE.Object3D) => void
  handleCopy: (object: THREE.Object3D) => void
  handlePaste: (targetObject: THREE.Object3D) => void
  handleMove: (object: THREE.Object3D, newParent: THREE.Object3D) => void
  handleDelete: (object: THREE.Object3D) => void
  toggleVisibility: (object: THREE.Object3D) => void
}

function SceneGraphNode({
  object,
  isExpanded,
  isSelected,
  isInSearchResults,
  hasClipboardData,
  canPaste,
  onToggleExpanded,
  onSelect,
  onCopy,
  onPaste,
  onMove,
  onDelete,
  onToggleVisibility,
  shouldShowNode,
  expandedNodes,
  selectedUuid,
  searchResults,
  clipboard,
  side,
  onNodeSelect,
  onClipboardChange,
  onSceneChange,
  scene,
  isSystemObject,
  toggleExpanded,
  handleNodeSelect,
  handleCopy,
  handlePaste,
  handleMove,
  handleDelete,
  toggleVisibility
}: SceneGraphNodeProps) {
  const [isCopied, setIsCopied] = useState(false)
  const hasChildren = object.children.filter(shouldShowNode).length > 0
  const childCount = object.children.length
  const isScene = object.type === "Scene"
  const isSystem = isSystemObject(object)
  
  // 복사 상태 초기화
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isCopied])
  
  // 노드 타입에 따른 아이콘
  const getNodeIcon = (obj: THREE.Object3D): string => {
    if (obj.type === "Scene") return "🌐"
    if (obj instanceof THREE.Mesh) return "📦"
    if (obj instanceof THREE.Group) return "📁"
    if (obj instanceof THREE.Bone) return "🦴"
    if ((obj as any).isLight) {
      if (obj.type === "DirectionalLight") return "☀️"
      if (obj.type === "AmbientLight") return "💡"
      if (obj.type === "PointLight") return "🔆"
      if (obj.type === "SpotLight") return "🔦"
      return "💡"
    }
    if (obj instanceof THREE.Camera) {
      if (obj.type === "PerspectiveCamera") return "📹"
      if (obj.type === "OrthographicCamera") return "📷"
      return "📸"
    }
    if (obj.type === "GridHelper") return "🔲"
    return "⚪"
  }
  
  // 노드 타입에 따른 배지 색상
  const getNodeBadgeColor = (obj: THREE.Object3D): string => {
    if (obj.type === "Scene") return "bg-purple-100 text-purple-800"
    if (obj instanceof THREE.Mesh) return "bg-blue-100 text-blue-800"
    if (obj instanceof THREE.Group) return "bg-green-100 text-green-800"
    if (obj instanceof THREE.Bone) return "bg-orange-100 text-orange-800"
    if ((obj as any).isLight) return "bg-yellow-100 text-yellow-800"
    if (obj instanceof THREE.Camera) return "bg-indigo-100 text-indigo-800"
    if (isSystemObject(obj)) return "bg-gray-100 text-gray-600"
    return "bg-slate-100 text-slate-800"
  }
  
  // 복사 버튼 클릭 처리
  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isScene) { // Scene 자체는 복사하지 않음
      onCopy()
      setIsCopied(true)
    }
  }
  
  // 붙여넣기 버튼 클릭 처리
  const handlePasteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPaste()
  }
  
  // 삭제 버튼 클릭 처리
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isScene && !isSystem) { // Scene이나 시스템 객체는 삭제하지 않음
      onDelete()
    }
  }
  
  // 가시성 토글 클릭 처리
  const handleVisibilityClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isScene) { // Scene 자체의 가시성은 조절하지 않음
      onToggleVisibility()
    }
  }
  
  // 노드 이름 표시
  const displayName = object.name || `${object.type}_${object.uuid.slice(0, 6)}`
  const truncatedName = displayName.length > 25 ? `${displayName.slice(0, 22)}...` : displayName
  
  // 객체 정보 수집
  const objectInfo: string[] = []
  if (object instanceof THREE.Mesh) {
    objectInfo.push(`Geo: ${object.geometry.type}`)
    if (object.material) {
      const matType = Array.isArray(object.material) ? 
        `${object.material.length} materials` : 
        object.material.type
      objectInfo.push(`Mat: ${matType}`)
    }
  }
  if (object.type === "Scene") {
    objectInfo.push(`Root`)
  }
  
  return (
    <div className={`${isScene ? '' : 'ml-3'}`}>
      <div 
        className={`flex items-center py-1 px-2 rounded cursor-pointer transition-colors
          ${isSelected ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-50'}
          ${isInSearchResults ? 'ring-2 ring-yellow-400' : ''}
          ${isSystem ? 'bg-gray-50' : ''}
        `}
        onClick={onSelect}
      >
        {/* 펼치기/접기 버튼 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpanded()
            }}
            className="mr-1 p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label={isExpanded ? "접기" : "펼치기"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-6" />
        )}
        
        {/* 아이콘 */}
        <span className="mr-2 text-sm">{getNodeIcon(object)}</span>
        
        {/* 노드 이름과 정보 */}
        <span className="flex-grow truncate flex items-center gap-2">
          <span className={`font-mono text-sm ${isScene ? 'font-bold' : ''}`}>
            {truncatedName}
          </span>
          
          {/* 노드 타입 배지 */}
          <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${getNodeBadgeColor(object)}`}>
            {object.type}
          </Badge>
          
          {/* 자식 수 배지 */}
          {childCount > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-gray-100 text-gray-600">
              {childCount}
            </Badge>
          )}
          
          {/* 추가 정보 배지들 */}
          {objectInfo.map((info, idx) => (
            <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0 h-5 bg-blue-50 text-blue-700">
              {info}
            </Badge>
          ))}
          
          {/* 시스템 객체 표시 */}
          {isSystem && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-orange-50 text-orange-700">
              System
            </Badge>
          )}
        </span>
        
        {/* 액션 버튼들 */}
        <div className="flex items-center gap-1">
          {/* 가시성 토글 (Scene 제외) */}
          {!isScene && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={handleVisibilityClick}
                  aria-label={object.visible ? "숨기기" : "보이기"}
                >
                  {object.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-gray-400" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{object.visible ? "객체 숨기기" : "객체 보이기"}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* 복사 버튼 (Scene 제외) */}
          {!isScene && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={handleCopyClick}
                  aria-label="복사"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>이 객체 복사 (Scene Graph 간)</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* 붙여넣기 버튼 */}
          {hasClipboardData && canPaste && !isScene && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 border-primary"
                  onClick={handlePasteClick}
                  aria-label="붙여넣기"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>클립보드에서 이 객체에 붙여넣기</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Scene Graph 내 이동 버튼 */}
          {hasClipboardData && clipboard?.source === side && !isScene && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 border-green-500"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (clipboard?.object) {
                      handleMove(clipboard.object, object)
                    }
                  }}
                  aria-label="이동"
                >
                  <Shuffle className="h-3.5 w-3.5 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>여기로 이동 (같은 Scene Graph 내)</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* 삭제 버튼 (Scene이나 시스템 객체 제외) */}
          {!isScene && !isSystem && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteClick}
                  aria-label="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>이 객체 삭제</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      
      {/* 자식 노드들 */}
      {isExpanded && hasChildren && (
        <div className={`${isScene ? '' : 'border-l pl-2 ml-2'}`}>
          {object.children
            .filter(shouldShowNode)
            .map(child => (
              <SceneGraphNode
                key={child.uuid}
                object={child}
                isExpanded={expandedNodes.has(child.uuid)}
                isSelected={selectedUuid === child.uuid}
                isInSearchResults={searchResults.includes(child)}
                hasClipboardData={hasClipboardData}
                canPaste={canPaste}
                onToggleExpanded={() => toggleExpanded(child.uuid)}
                onSelect={() => handleNodeSelect(child)}
                onCopy={() => handleCopy(child)}
                onPaste={() => handlePaste(child)}
                onMove={handleMove}
                onDelete={() => handleDelete(child)}
                onToggleVisibility={() => toggleVisibility(child)}
                shouldShowNode={shouldShowNode}
                expandedNodes={expandedNodes}
                selectedUuid={selectedUuid}
                searchResults={searchResults}
                clipboard={clipboard}
                side={side}
                onNodeSelect={onNodeSelect}
                onClipboardChange={onClipboardChange}
                onSceneChange={onSceneChange}
                scene={scene}
                isSystemObject={isSystemObject}
                toggleExpanded={toggleExpanded}
                handleNodeSelect={handleNodeSelect}
                handleCopy={handleCopy}
                handlePaste={handlePaste}
                handleMove={handleMove}
                handleDelete={handleDelete}
                toggleVisibility={toggleVisibility}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// %%%%%LAST%%%%%