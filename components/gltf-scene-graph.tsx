"use client"

import React, { useState, useMemo } from "react"
import { Move, Copy, Trash2, Search, Filter, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Document } from '@gltf-transform/core'
import * as THREE from "three"
import { 
  extractSceneGraphHierarchy, 
  searchNodes,
  type GLTFNodeInfo 
} from "@/lib/gltf-transform-utils"

interface GLTFSceneGraphProps {
  document: Document | null
  onNodeMove?: (sourceNodeId: string, targetNodeId: string) => void
  onNodeCopy?: (sourceNodeId: string, targetNodeId: string) => void
  onNodeDelete?: (nodeId: string) => void
  onSceneUpdate?: () => void
  side: "left" | "right"
  otherSideDocument?: Document | null
  clipboard?: {
    nodeInfo: GLTFNodeInfo | null
    source: "left" | "right" | null
  }
  onClipboardChange?: (data: { nodeInfo: GLTFNodeInfo | null; source: "left" | "right" | null }) => void
  onNodeVisibilityChange?: (nodeId: string, visible: boolean) => void
  threeScene?: THREE.Scene | null
}

/**
 * gltf-transform 기반 Scene Graph 전용 컴포넌트
 * 노드 간 이동, 복사, 삭제에 특화된 UI 제공
 */
export function GLTFSceneGraph({
  document,
  onNodeMove,
  onNodeCopy,
  onNodeDelete,
  onSceneUpdate,
  side,
  otherSideDocument,
  clipboard,
  onClipboardChange,
  onNodeVisibilityChange,
  threeScene
}: GLTFSceneGraphProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [nodeVisibility, setNodeVisibility] = useState<Record<string, boolean>>({})
  
  // Scene Graph 계층구조 추출
  const sceneGraph = useMemo(() => {
    if (!document) return []
    try {
      return extractSceneGraphHierarchy(document)
    } catch (error) {
      console.error("Scene graph hierarchy extraction failed:", error)
      return []
    }
  }, [document])
  
  // 검색 및 필터링
  const filteredNodes = useMemo(() => {
    if (!document) return []
    
    let nodes = sceneGraph
    
    // 검색 필터링
    if (searchQuery.trim()) {
      try {
        const searchResults = searchNodes(document, searchQuery.trim())
        return searchResults
      } catch (error) {
        console.error("Search failed:", error)
        return []
      }
    }
    
    // 타입 필터링
    if (filterType !== "all") {
      const filterNodes = (nodeList: GLTFNodeInfo[]): GLTFNodeInfo[] => {
        return nodeList.reduce((filtered: GLTFNodeInfo[], node) => {
          if (node.type === filterType) {
            filtered.push(node)
          }
          if (node.children.length > 0) {
            const filteredChildren = filterNodes(node.children)
            if (filteredChildren.length > 0) {
              filtered.push({
                ...node,
                children: filteredChildren
              })
            }
          }
          return filtered
        }, [])
      }
      nodes = filterNodes(nodes)
    }
    
    return nodes
  }, [document, sceneGraph, searchQuery, filterType])
  // 노드 토글
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  // 노드 가시성 토글
  const toggleNodeVisibility = (nodeId: string) => {
    const isCurrentlyVisible = nodeVisibility[nodeId] !== false // 기본값은 true
    
    // 상태 업데이트
    setNodeVisibility(prev => ({
      ...prev,
      [nodeId]: !isCurrentlyVisible
    }))
    
    // Three.js 렌더링에도 반영
    if (threeScene && onNodeVisibilityChange) {
      onNodeVisibilityChange(nodeId, !isCurrentlyVisible)
      console.log(`노드 가시성 토글 이벤트 발생: ${nodeId}, 새 상태: ${!isCurrentlyVisible ? '표시' : '숨김'}`)
    }
  }

  // 노드 선택
  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
  }

  // 노드 복사 (클립보드에 저장)
  const copyNodeToClipboard = (nodeInfo: GLTFNodeInfo) => {
    onClipboardChange?.({
      nodeInfo,
      source: side
    })
  }

  // 클립보드에서 붙여넣기
  const pasteFromClipboard = (targetNodeId: string) => {
    if (!clipboard?.nodeInfo || clipboard.source === side) return
    
    onNodeCopy?.(clipboard.nodeInfo.id, targetNodeId)
    onSceneUpdate?.()
  }

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (e: React.DragEvent, nodeInfo: GLTFNodeInfo) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      nodeId: nodeInfo.id,
      nodeName: nodeInfo.name,
      source: side
    }))
  }

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault()
    setDragOverNodeId(nodeId)
  }

  const handleDragLeave = () => {
    setDragOverNodeId(null)
  }

  const handleDrop = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault()
    setDragOverNodeId(null)
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (data.nodeId && data.nodeId !== targetNodeId) {
        onNodeMove?.(data.nodeId, targetNodeId)
        onSceneUpdate?.()
      }
    } catch (error) {
      console.error('Drop operation failed:', error)
    }
  }

  if (!document) {
    return (
      <div className="border rounded p-3 max-h-[400px] overflow-auto">
        <h3 className="font-medium mb-2">Scene Graph</h3>
        <p className="text-sm text-gray-500">모델이 로드되지 않았습니다.</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="border rounded p-3 max-h-[400px] overflow-auto space-y-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Scene Graph (노드 편집)</h3>
          <div className="flex gap-2">
            {clipboard?.nodeInfo && clipboard.source !== side && (
              <Badge variant="secondary" className="text-xs">
                클립보드: {clipboard.nodeInfo.name}
              </Badge>
            )}
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="노드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="scenes">씬</SelectItem>
              <SelectItem value="nodes">노드</SelectItem>
              <SelectItem value="meshes">메시</SelectItem>
              <SelectItem value="materials">머티리얼</SelectItem>
              <SelectItem value="textures">텍스처</SelectItem>
              <SelectItem value="animations">애니메이션</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Scene Graph 트리 - 실제 계층구조 */}
        <div className="space-y-1">
          {filteredNodes.map(sceneInfo => (
            <SceneGraphNode
              key={sceneInfo.id}
              nodeInfo={sceneInfo}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              dragOverNodeId={dragOverNodeId}
              nodeVisibility={nodeVisibility}
              onToggle={toggleNode}
              onSelect={selectNode}
              onCopy={copyNodeToClipboard}
              onPaste={pasteFromClipboard}
              onDelete={onNodeDelete}
              onToggleVisibility={toggleNodeVisibility}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              clipboard={clipboard}
              side={side}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
/**
 * Scene Graph 노드 컴포넌트
 */
interface SceneGraphNodeProps {
  nodeInfo: GLTFNodeInfo
  selectedNodeId: string | null
  expandedNodes: Set<string>
  dragOverNodeId: string | null
  nodeVisibility: Record<string, boolean>
  onToggle: (nodeId: string) => void
  onSelect: (nodeId: string) => void
  onCopy: (nodeInfo: GLTFNodeInfo) => void
  onPaste: (targetNodeId: string) => void
  onDelete?: (nodeId: string) => void
  onToggleVisibility: (nodeId: string) => void
  onDragStart: (e: React.DragEvent, nodeInfo: GLTFNodeInfo) => void
  onDragOver: (e: React.DragEvent, nodeId: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, targetNodeId: string) => void
  clipboard?: {
    nodeInfo: GLTFNodeInfo | null
    source: "left" | "right" | null
  }
  side: "left" | "right"
}

function SceneGraphNode({
  nodeInfo,
  selectedNodeId,
  expandedNodes,
  dragOverNodeId,
  nodeVisibility,
  onToggle,
  onSelect,
  onCopy,
  onPaste,
  onDelete,
  onToggleVisibility,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  clipboard,
  side
}: SceneGraphNodeProps) {
  const isExpanded = expandedNodes.has(nodeInfo.id)
  const isSelected = selectedNodeId === nodeInfo.id
  const hasChildren = nodeInfo.children.length > 0
  const isDragOver = dragOverNodeId === nodeInfo.id
  const canPaste = clipboard?.nodeInfo && clipboard.source !== side
  const isVisible = nodeVisibility[nodeInfo.id] !== false // 기본값은 true

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1 p-2 rounded cursor-pointer group transition-colors ${
          isSelected ? 'bg-blue-100 border border-blue-300' : 
          isDragOver ? 'bg-green-100 border border-green-300' :
          'hover:bg-gray-100'
        }`}
        style={{ marginLeft: `${nodeInfo.depth * 16}px` }}
        draggable={nodeInfo.type === 'Node'}
        onDragStart={(e) => onDragStart(e, nodeInfo)}
        onDragOver={(e) => onDragOver(e, nodeInfo.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, nodeInfo.id)}
        onClick={(e) => {
          if (hasChildren) {
            onToggle(nodeInfo.id)
          }
          onSelect(nodeInfo.id)
        }}
      >
        {/* 가시성 토글 버튼 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`p-0 h-5 w-5 ${!isVisible ? 'text-gray-400' : 'text-blue-500'}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleVisibility(nodeInfo.id)
              }}
            >
              {isVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isVisible ? '숨기기' : '표시하기'}</TooltipContent>
        </Tooltip>

        {/* 노드 정보 */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Badge 
            variant={nodeInfo.type === 'scenes' ? 'default' : 'outline'} 
            className="text-xs"
          >
            {nodeInfo.type === 'scenes' ? 'Scene' : 'Node'}
          </Badge>
          <span className="text-sm truncate font-medium">
            {nodeInfo.name}
          </span>
          {nodeInfo.properties.mesh && (
            <Badge variant="secondary" className="text-xs">
              Mesh
            </Badge>
          )}
          {hasChildren && (
            <span className="text-xs text-gray-500">
              ({nodeInfo.children.length})
            </span>
          )}
        </div>

        {/* 액션 버튼들 */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy(nodeInfo)
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>복사</TooltipContent>
          </Tooltip>

          {canPaste && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6 text-green-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPaste(nodeInfo.id)
                  }}
                >
                  <Move className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>붙여넣기</TooltipContent>
            </Tooltip>
          )}

          {nodeInfo.type === 'nodes' && onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6 text-red-500"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(nodeInfo.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>삭제</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 자식 노드들 */}
      {isExpanded && hasChildren && (
        <div>
          {nodeInfo.children.map(childInfo => (
            <SceneGraphNode
              key={childInfo.id}
              nodeInfo={childInfo}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              dragOverNodeId={dragOverNodeId}
              nodeVisibility={nodeVisibility}
              onToggle={onToggle}
              onSelect={onSelect}
              onCopy={onCopy}
              onPaste={onPaste}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              clipboard={clipboard}
              side={side}
            />
          ))}
        </div>
      )}
    </div>
  )
}