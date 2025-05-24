 "use client"

import React, { useState, useEffect, useMemo } from "react"
import { ChevronRight, ChevronDown, Trash2, Eye, EyeOff, Search, Database, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Document } from '@gltf-transform/core'
import { 
  extractSceneGraph, 
  extractResourceInfo, 
  searchNodes,
  calculateNodeStats,
  type GLTFNodeInfo 
} from "@/lib/gltf-transform-utils"

interface GLTFModelTreeProps {
  document: Document | null
  onNodeSelect?: (nodeInfo: GLTFNodeInfo | null) => void
  onNodeMove?: (sourceNodeId: string, targetNodeId: string) => void
  onNodeDelete?: (nodeId: string) => void
  side: "left" | "right"
}

/**
 * gltf-transform 기반 모델 구조 트리 컴포넌트
 * Document에서 glTF 구조를 추출하여 트리 형태로 표시
 */
export function GLTFModelTree({
  document,
  onNodeSelect,
  onNodeMove, 
  onNodeDelete,
  side
}: GLTFModelTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showStats, setShowStats] = useState(false)
  
  // glTF 구조 추출 - modelStructure 변경 시에도 업데이트되도록 수정
  const sceneGraph = useMemo(() => {
    if (!document) return []
    try {
      console.log('GLTFModelTree: Document 구조 추출 중...')
      const result = extractSceneGraph(document)
      console.log('GLTFModelTree: 추출된 구조:', result.length, '개 섹션')
      return result
    } catch (error) {
      console.error("glTF structure extraction failed:", error)
      return []
    }
  }, [document]) // modelStructure 의존성 제거하고 document만 의존
  
  // 리소스 정보 추출
  const resourceInfo = useMemo(() => {
    if (!document) return null
    try {
      return extractResourceInfo(document)
    } catch (error) {
      console.error("Resource info extraction failed:", error)
      return null
    }
  }, [document])
  
  // 검색 결과
  const searchResults = useMemo(() => {
    if (!document || !searchQuery.trim()) return []
    try {
      return searchNodes(document, searchQuery.trim())
    } catch (error) {
      console.error("Node search failed:", error)
      return []
    }
  }, [document, searchQuery])

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

  // 노드 선택
  const selectNode = (nodeInfo: GLTFNodeInfo) => {
    setSelectedNodeId(nodeInfo.id)
    onNodeSelect?.(nodeInfo)
  }
  

  // 노드 삭제
  const deleteNode = (nodeId: string) => {
    onNodeDelete?.(nodeId)
  }

  if (!document) {
    return (
      <div className="border rounded p-3 max-h-[400px] overflow-auto">
        <h3 className="font-medium mb-2">모델 구조</h3>
        <p className="text-sm text-gray-500">모델이 로드되지 않았습니다.</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="border rounded p-3 max-h-[400px] overflow-auto space-y-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium">모델 구조 (glTF-Transform)</h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
            >
              <Database className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 검색 */}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="노드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* 통계 정보 */}
        {showStats && resourceInfo && (
          <div className="bg-gray-50 rounded p-2 text-xs space-y-1">
            <div>씬: {resourceInfo.scenes}개</div>
            <div>노드: {resourceInfo.nodes}개</div>
            <div>메시: {resourceInfo.meshes}개</div>
            <div>머티리얼: {resourceInfo.materials}개</div>
            <div>텍스처: {resourceInfo.textures}개</div>
            <div>애니메이션: {resourceInfo.animations}개</div>
            <div>스킨: {resourceInfo.skins}개</div>
            <div>확장: {resourceInfo.extensions}개</div>
          </div>
        )}

        {/* 검색 결과 */}
        {searchQuery.trim() && (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-600">
              검색 결과 ({searchResults.length}개)
            </div>
            {searchResults.map(nodeInfo => (
              <div 
                key={nodeInfo.id}
                className="text-sm p-1 rounded cursor-pointer hover:bg-gray-100"
                onClick={() => selectNode(nodeInfo)}
              >
                {nodeInfo.name} ({nodeInfo.type})
              </div>
            ))}
          </div>
        )}

        {/* glTF 구조 트리 */}
        {!searchQuery.trim() && (
          <div className="space-y-1">
            {sceneGraph.map(section => (
              <GLTFSectionComponent
                key={section.id}
                nodeInfo={section}
                selectedNodeId={selectedNodeId}
                expandedNodes={expandedNodes}
                onToggle={toggleNode}
                onSelect={selectNode}
                // onCopy prop removed
                onDelete={deleteNode}
                side={side}
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * 개별 glTF 섹션 컴포넌트
 */
interface GLTFSectionComponentProps {
  nodeInfo: GLTFNodeInfo
  selectedNodeId: string | null
  expandedNodes: Set<string>
  onToggle: (nodeId: string) => void
  onSelect: (nodeInfo: GLTFNodeInfo) => void
  onDelete: (nodeId: string) => void
  clipboard?: {
    nodeInfo: GLTFNodeInfo | null
    source: "left" | "right" | null
  }
  side: "left" | "right"
}

function GLTFSectionComponent({
  nodeInfo,
  selectedNodeId,
  expandedNodes,
  onToggle,
  onSelect,
  onCopy,
  onDelete,
  clipboard,
  side
}: GLTFSectionComponentProps) {
  const isExpanded = expandedNodes.has(nodeInfo.id)
  const isSelected = selectedNodeId === nodeInfo.id
  const hasChildren = nodeInfo.children.length > 0

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1 p-1 rounded cursor-pointer group ${
          isSelected ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
        }`}
        style={{ marginLeft: `${nodeInfo.depth * 16}px` }}
      >
        {/* 펼치기/접기 버튼 */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-4 w-4"
            onClick={() => onToggle(nodeInfo.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <div className="w-4" />
        )}

        {/* 섹션 정보 */}
        <div 
          className="flex-1 flex items-center gap-2 min-w-0"
          onClick={() => onSelect(nodeInfo)}
        >
          <Badge 
            variant={nodeInfo.depth === 0 ? 'default' : 'outline'} 
            className="text-xs"
          >
            {nodeInfo.type}
          </Badge>
          <span className="text-sm truncate font-medium">
            {nodeInfo.name}
          </span>
          <span className="text-xs text-gray-500">
            ({nodeInfo.count})
          </span>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          {nodeInfo.depth > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6 text-red-500"
                  onClick={() => onDelete(nodeInfo.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>항목 삭제</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 자식 항목들 */}
      {isExpanded && hasChildren && (
        <div>
          {nodeInfo.children.map(childInfo => (
            <GLTFSectionComponent
              key={childInfo.id}
              nodeInfo={childInfo}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
              clipboard={clipboard}
              side={side}
            />
          ))}
        </div>
      )}
    </div>
  )
}
