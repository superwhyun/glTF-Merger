"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { ChevronRight, ChevronDown, Copy, Clipboard, Check, Trash2, Eye, EyeOff, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import * as THREE from "three"
import {
  findObjectInScene,
  getObjectPath,
  sceneToHierarchy,
  NodeSearcher,
  copyObjectToParent,
  moveObjectToParent,
  removeObjectFromScene,
  type NodeSelectionState
} from "@/lib/three-scene-utils"

interface EnhancedModelTreeProps {
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
 * Three.js 씬 기반의 개선된 모델 트리 컴포넌트
 * 실제 Object3D 계층구조를 정확하게 반영하고 조작
 */
export function EnhancedModelTree({
  scene,
  onSceneChange,
  onNodeSelect,
  side,
  otherSideScene,
  clipboard,
  onClipboardChange
}: EnhancedModelTreeProps) {
  const [hierarchy, setHierarchy] = useState<any>(null)
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<THREE.Object3D[]>([])
  const [filterType, setFilterType] = useState<string>("all")
  const [showInvisible, setShowInvisible] = useState(true)
  
  const searcherRef = useRef<NodeSearcher | null>(null)
  
  // 씬이 변경될 때 계층구조 업데이트
  useEffect(() => {
    if (scene) {
      const newHierarchy = sceneToHierarchy(scene)
      setHierarchy(newHierarchy)
      searcherRef.current = new NodeSearcher(scene)
      
      // 기본적으로 루트 노드들을 펼쳐둠
      const rootUuids = scene.children
        .filter(child => {
          // 간단한 필터링만 적용 (무한 루프 방지)
          if (!showInvisible && !child.visible) return false
          return true
        })
        .map(child => child.uuid)
      setExpandedNodes(new Set(rootUuids))
    } else {
      setHierarchy(null)
      searcherRef.current = null
      setExpandedNodes(new Set())
    }
  }, [scene, showInvisible])
  
  // 검색 기능
  useEffect(() => {
    if (searchQuery && searcherRef.current) {
      const results = searcherRef.current.searchByName(searchQuery, false)
      setSearchResults(results)
      
      // 검색 결과가 있는 노드들을 자동으로 펼쳐줌
      const pathsToExpand = new Set(expandedNodes)
      results.forEach(obj => {
        const path = getObjectPath(obj)
        let current = scene
        path.forEach(name => {
          if (current) {
            const found = current.children.find(child => child.name === name)
            if (found) {
              pathsToExpand.add(found.uuid)
              current = found as any
            }
          }
        })
      })
      setExpandedNodes(pathsToExpand)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, scene]) // expandedNodes 제거하여 무한 루프 방지
  
  // 노드가 표시되어야 하는지 확인 (useCallback으로 메모이제이션)
  const shouldShowNode = useCallback((object: THREE.Object3D): boolean => {
    // 보이지 않는 노드 필터링
    if (!showInvisible && !object.visible) return false
    
    // 타입 필터링
    if (filterType !== "all") {
      if (filterType === "mesh" && !(object instanceof THREE.Mesh)) return false
      if (filterType === "group" && object.type !== "Group") return false
      if (filterType === "bone" && object.type !== "Bone") return false
      if (filterType === "light" && !(object as any).isLight) return false
    }
    
    // 검색 결과 필터링
    if (searchResults.length > 0) {
      return searchResults.includes(object) || 
             searchResults.some(result => isDescendant(object, result)) ||
             searchResults.some(result => isDescendant(result, object))
    }
    
    return true
  }, [showInvisible, filterType, searchResults])
  
  // 노드가 다른 노드의 후손인지 확인 (useCallback으로 메모이제이션)
  const isDescendant = useCallback((ancestor: THREE.Object3D, descendant: THREE.Object3D): boolean => {
    let current: THREE.Object3D | null = descendant.parent
    while (current) {
      if (current === ancestor) return true
      current = current.parent
    }
    return false
  }, [])
  
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
  
  // 노드 붙여넣기
  const handlePaste = (targetObject: THREE.Object3D) => {
    if (!clipboard?.object || !scene) return
    
    // 같은 쪽에서는 붙여넣기 불가
    if (clipboard.source === side) return
    
    const result = copyObjectToParent(clipboard.object, targetObject)
    if (result.success && onSceneChange) {
      onSceneChange(scene)
      // 계층구조 재구성
      const newHierarchy = sceneToHierarchy(scene)
      setHierarchy(newHierarchy)
    }
  }
  
  // 노드 이동 (같은 씬 내에서)
  const handleMove = (object: THREE.Object3D, newParent: THREE.Object3D) => {
    if (!scene) return
    
    const result = moveObjectToParent(object, newParent)
    if (result.success && onSceneChange) {
      onSceneChange(scene)
      // 계층구조 재구성
      const newHierarchy = sceneToHierarchy(scene)
      setHierarchy(newHierarchy)
    }
  }
  
  // 노드 삭제
  const handleDelete = (object: THREE.Object3D) => {
    if (!scene) return
    
    const result = removeObjectFromScene(object)
    if (result.success && onSceneChange) {
      onSceneChange(scene)
      // 계층구조 재구성
      const newHierarchy = sceneToHierarchy(scene)
      setHierarchy(newHierarchy)
      
      // 선택된 노드가 삭제된 경우 선택 해제
      if (selectedUuid === object.uuid) {
        setSelectedUuid(null)
        if (onNodeSelect) {
          onNodeSelect(null)
        }
      }
    }
  }
  
  // 노드 가시성 토글
  const toggleVisibility = (object: THREE.Object3D) => {
    object.visible = !object.visible
    if (onSceneChange) {
      onSceneChange(scene!)
    }
  }
  
  // 노드 타입에 따른 아이콘 반환
  const getNodeIcon = (object: THREE.Object3D): string => {
    if (object instanceof THREE.Mesh) return "📦"
    if (object instanceof THREE.Group) return "📁"
    if (object instanceof THREE.Bone) return "🦴"
    if (object.type === "Scene") return "🌐"
    if ((object as any).isLight) return "💡"
    if (object instanceof THREE.Camera) return "📷"
    return "⚪"
  }
  
  // 노드 타입에 따른 배지 색상
  const getNodeBadgeColor = (object: THREE.Object3D): string => {
    if (object instanceof THREE.Mesh) return "bg-blue-100 text-blue-800"
    if (object instanceof THREE.Group) return "bg-green-100 text-green-800"
    if (object instanceof THREE.Bone) return "bg-purple-100 text-purple-800"
    if ((object as any).isLight) return "bg-yellow-100 text-yellow-800"
    if (object instanceof THREE.Camera) return "bg-indigo-100 text-indigo-800"
    return "bg-gray-100 text-gray-800"
  }
  
  if (!scene || !hierarchy) {
    return (
      <div className="border rounded p-3 text-center text-gray-500">
        모델을 로드하면 계층구조가 표시됩니다
      </div>
    )
  }
  
  return (
    <div className="border rounded p-3">
      <div className="mb-3 space-y-2">
        <h3 className="font-medium">모델 구조 (Three.js 기반)</h3>
        
        {/* 검색 및 필터 */}
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="노드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="mesh">메시</SelectItem>
              <SelectItem value="group">그룹</SelectItem>
              <SelectItem value="bone">본</SelectItem>
              <SelectItem value="light">조명</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* 옵션 토글 */}
        <div className="flex gap-2 text-sm">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showInvisible}
              onChange={(e) => setShowInvisible(e.target.checked)}
              className="w-3 h-3"
            />
            숨겨진 노드 표시
          </label>
        </div>
        
        {searchResults.length > 0 && (
          <div className="text-sm text-blue-600">
            검색 결과: {searchResults.length}개
          </div>
        )}
      </div>
      
      <div className="max-h-[400px] overflow-auto">
        {scene.children
          .filter(shouldShowNode)
          .map(child => (
            <ObjectNode
              key={child.uuid}
              object={child}
              isExpanded={expandedNodes.has(child.uuid)}
              isSelected={selectedUuid === child.uuid}
              isInSearchResults={searchResults.includes(child)}
              hasClipboardData={!!clipboard?.object}
              canPaste={clipboard?.source !== side}
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
            />
          ))}
      </div>
    </div>
  )
}

/**
 * 개별 노드를 렌더링하는 컴포넌트
 */
interface ObjectNodeProps {
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
}

function ObjectNode({
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
  scene
}: ObjectNodeProps) {
  const [isCopied, setIsCopied] = useState(false)
  const hasChildren = object.children.filter(shouldShowNode).length > 0
  const childCount = object.children.length
  
  // 복사 상태 초기화
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isCopied])
  
  // 노드 타입에 따른 아이콘
  const getNodeIcon = (obj: THREE.Object3D): string => {
    if (obj instanceof THREE.Mesh) return "📦"
    if (obj instanceof THREE.Group) return "📁"
    if (obj instanceof THREE.Bone) return "🦴"
    if (obj.type === "Scene") return "🌐"
    if ((obj as any).isLight) return "💡"
    if (obj instanceof THREE.Camera) return "📷"
    return "⚪"
  }
  
  // 노드 타입에 따른 배지 색상
  const getNodeBadgeColor = (obj: THREE.Object3D): string => {
    if (obj instanceof THREE.Mesh) return "bg-blue-100 text-blue-800"
    if (obj instanceof THREE.Group) return "bg-green-100 text-green-800"
    if (obj instanceof THREE.Bone) return "bg-purple-100 text-purple-800"
    if ((obj as any).isLight) return "bg-yellow-100 text-yellow-800"
    if (obj instanceof THREE.Camera) return "bg-indigo-100 text-indigo-800"
    return "bg-gray-100 text-gray-800"
  }
  
  // 복사 버튼 클릭 처리
  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCopy()
    setIsCopied(true)
  }
  
  // 붙여넣기 버튼 클릭 처리
  const handlePasteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPaste()
  }
  
  // 삭제 버튼 클릭 처리
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Scene이나 중요한 시스템 객체는 삭제 방지
    if (object.type === "Scene" || object.type === "DirectionalLight" || 
        object.type === "AmbientLight" || object.type === "GridHelper") {
      return
    }
    onDelete()
  }
  
  // 가시성 토글 클릭 처리
  const handleVisibilityClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleVisibility()
  }
  
  // 노드 이름 표시 (길이 제한)
  const displayName = object.name || object.uuid.slice(0, 8)
  const truncatedName = displayName.length > 20 ? `${displayName.slice(0, 17)}...` : displayName
  
  return (
    <div className="ml-2">
      <div 
        className={`flex items-center py-1 px-2 rounded cursor-pointer transition-colors
          ${isSelected ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-50'}
          ${isInSearchResults ? 'ring-2 ring-yellow-400' : ''}
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
            className="mr-1 p-1 hover:bg-gray-200 rounded"
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
          <span className="font-mono text-sm">{truncatedName}</span>
          
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
          
          {/* 메시 정보 */}
          {object instanceof THREE.Mesh && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-blue-50 text-blue-700">
              {object.geometry.type}
            </Badge>
          )}
        </span>
        
        {/* 액션 버튼들 */}
        <div className="flex items-center gap-1">
          {/* 가시성 토글 */}
          <TooltipProvider>
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
                <p>{object.visible ? "노드 숨기기" : "노드 보이기"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* 복사 버튼 */}
          <TooltipProvider>
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
                <p>이 노드 복사</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* 붙여넣기 버튼 */}
          {hasClipboardData && canPaste && (
            <TooltipProvider>
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
                  <p>클립보드에서 붙여넣기</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* 삭제 버튼 (시스템 객체가 아닌 경우에만) */}
          {object.type !== "Scene" && 
           object.type !== "DirectionalLight" && 
           object.type !== "AmbientLight" && 
           object.type !== "GridHelper" && (
            <TooltipProvider>
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
                  <p>이 노드 삭제</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {/* 자식 노드들 */}
      {isExpanded && hasChildren && (
        <div className="border-l pl-2 ml-2">
          {object.children
            .filter(shouldShowNode)
            .map(child => (
              <ObjectNode
                key={child.uuid}
                object={child}
                isExpanded={expandedNodes.has(child.uuid)}
                isSelected={selectedUuid === child.uuid}
                isInSearchResults={searchResults.includes(child)}
                hasClipboardData={hasClipboardData}
                canPaste={canPaste}
                onToggleExpanded={() => {
                  const newExpanded = new Set(expandedNodes)
                  if (newExpanded.has(child.uuid)) {
                    newExpanded.delete(child.uuid)
                  } else {
                    newExpanded.add(child.uuid)
                  }
                  // 부모 컴포넌트에 상태 업데이트 알림이 필요하지만 
                  // 현재 구조에서는 직접 처리
                }}
                onSelect={() => {
                  if (onNodeSelect) {
                    onNodeSelect(child)
                  }
                }}
                onCopy={() => {
                  if (onClipboardChange) {
                    onClipboardChange({ object: child, source: side })
                  }
                }}
                onPaste={() => {
                  if (clipboard?.object && onSceneChange) {
                    const result = copyObjectToParent(clipboard.object, child)
                    if (result.success) {
                      onSceneChange(scene)
                    }
                  }
                }}
                onMove={onMove}
                onDelete={() => {
                  if (onSceneChange) {
                    const result = removeObjectFromScene(child)
                    if (result.success) {
                      onSceneChange(scene)
                    }
                  }
                }}
                onToggleVisibility={() => {
                  child.visible = !child.visible
                  if (onSceneChange) {
                    onSceneChange(scene)
                  }
                }}
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
              />
            ))}
        </div>
      )}
    </div>
  )
}

// %%%%%LAST%%%%%