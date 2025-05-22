"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, Copy, Clipboard, Check, Trash2, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"

// ModelTreeProps 인터페이스 업데이트
interface ModelTreeProps {
  structure: any
  onCopy: (data: any) => void
  onPaste: (path: string[]) => void
  onDelete: (path: string[]) => void
  side: "left" | "right"
  otherSideHasData: boolean
  clipboard?: { data: any; source: "left" | "right" | null }
}

interface ClipboardData {
  data: any
  source: "left" | "right" | null
}

// ModelTree 함수에 onDelete 추가
export function ModelTree({ structure, onCopy, onPaste, onDelete, side, otherSideHasData, clipboard }: ModelTreeProps) {
  return (
    <TooltipProvider>
      <div className="border rounded p-3 max-h-[400px] overflow-auto">
        <h3 className="font-medium mb-2">모델 구조</h3>
        <TreeNode
          node={structure}
          path={[]}
          onCopy={onCopy}
          onPaste={onPaste}
          onDelete={onDelete}
          side={side}
          otherSideHasData={otherSideHasData}
          clipboard={clipboard}
          structure={structure}
        />
      </div>
    </TooltipProvider>
  )
}

interface TreeNodeProps {
  node: any
  path: string[]
  onCopy: (data: any) => void
  onPaste: (path: string[]) => void
  onDelete: (path: string[]) => void
  side: "left" | "right"
  otherSideHasData: boolean
  clipboard?: { data: any; source: "left" | "right" | null }
  structure: any // 전체 구조 참조 추가
}

function TreeNode({
  node,
  path,
  onCopy,
  onPaste,
  onDelete,
  side,
  otherSideHasData,
  clipboard,
  structure,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isPastable, setIsPastable] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [childNodes, setChildNodes] = useState<{ key: string; path: string[] }[]>([])

  // 현재 노드가 클립보드에 복사된 노드인지 확인
  useEffect(() => {
    if (clipboard?.data && clipboard.source !== side) {
      const clipboardPath = clipboard.data.path.join("/")
      const currentPath = path.join("/")
      setIsPastable(true)
    } else {
      setIsPastable(false)
    }
  }, [clipboard, path, side])

  // 자식 노드 관계 처리
  useEffect(() => {
    // 노드가 객체이고 children 속성이 있는 경우 (nodes 객체 내의 노드)
    if (node && typeof node === "object" && node.children && Array.isArray(node.children)) {
      const children: { key: string; path: string[] }[] = []

      // children 배열에 있는 노드 인덱스를 기반으로 실제 노드 찾기
      node.children.forEach((childIndex: number | string) => {
        // nodes 객체에서 해당 인덱스의 노드 찾기
        if (structure.nodes && structure.nodes[`node_${childIndex}`]) {
          children.push({
            key: `node_${childIndex}`,
            path: ["nodes", `node_${childIndex}`],
          })
        }
      })

      setChildNodes(children)
    } else {
      setChildNodes([])
    }
  }, [node, structure])

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCopy({ path, data: node })
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1500) // 1.5초 후 복사 상태 초기화
  }

  const handlePaste = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPaste(path)
  }

  const handleDelete = () => {
    onDelete(path)
    setIsDeleteDialogOpen(false)
  }

  const hasChildren =
    (typeof node === "object" && node !== null && Object.keys(node).length > 0) || childNodes.length > 0
  const nodeName = path[path.length - 1] || "Root"
  const isRoot = path.length === 0

  // 노드 타입 확인 (애니메이션, 메시, 재질 등)
  const getNodeType = () => {
    if (path.length === 0) return "root"

    const firstSegment = path[0]
    if (firstSegment === "animations") return "animation"
    if (firstSegment === "meshes") return "mesh"
    if (firstSegment === "materials") return "material"
    if (firstSegment === "nodes") return "node"
    if (firstSegment === "textures") return "texture"
    if (firstSegment === "scenes") return "scene"

    return "unknown"
  }

  // 노드 타입에 따른 배지 색상
  const getBadgeColor = () => {
    const type = getNodeType()
    switch (type) {
      case "animation":
        return "bg-purple-100 text-purple-800"
      case "mesh":
        return "bg-blue-100 text-blue-800"
      case "material":
        return "bg-yellow-100 text-yellow-800"
      case "node":
        return "bg-green-100 text-green-800"
      case "texture":
        return "bg-pink-100 text-pink-800"
      case "scene":
        return "bg-indigo-100 text-indigo-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="ml-2">
      <div className="flex items-center py-1">
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="mr-1 p-1 hover:bg-gray-100 rounded"
            aria-label={isExpanded ? "접기" : "펼치기"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-6" />
        )}

        <span className="flex-grow truncate flex items-center gap-1">
          {nodeName}
          {!isRoot && (
            <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${getBadgeColor()}`}>
              {getNodeType()}
            </Badge>
          )}
          {childNodes.length > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-gray-100 text-gray-800">
              <Link className="h-3 w-3 mr-1" />
              {childNodes.length}
            </Badge>
          )}
        </span>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6" 
          onClick={handleCopy} 
          aria-label="복사"
          title="이 노드 복사"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>

        {otherSideHasData && (
          <Button
            variant={isPastable ? "outline" : "ghost"}
            size="icon"
            className={`h-6 w-6 ${isPastable ? "border-primary" : ""}`}
            onClick={handlePaste}
            aria-label="붙여넣기"
            title="클립보드에서 붙여넣기"
          >
            <Clipboard className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* 삭제 버튼 (루트 노드가 아닌 경우에만 표시) */}
        {!isRoot && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:bg-destructive/10"
            onClick={() => setIsDeleteDialogOpen(true)}
            aria-label="삭제"
            title="이 노드 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* 삭제 확인 다이얼로그 */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>노드 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                '{nodeName}' 노드를 삭제하시겠습니까? 이 작업은 취소할 수 있지만, 모든 하위 노드도 함께 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {isExpanded && hasChildren && (
        <div className="border-l pl-2 ml-2">
          {/* 일반 객체 속성 렌더링 */}
          {typeof node === "object" &&
            node !== null &&
            Object.entries(node)
              .filter(([key]) => key !== "children") // children 속성은 별도로 처리
              .map(([key, value]) => (
                <TreeNode
                  key={key}
                  node={value}
                  path={[...path, key]}
                  onCopy={onCopy}
                  onPaste={onPaste}
                  onDelete={onDelete}
                  side={side}
                  otherSideHasData={otherSideHasData}
                  clipboard={clipboard}
                  structure={structure}
                />
              ))}

          {/* 자식 노드 관계 렌더링 */}
          {childNodes.length > 0 && (
            <div className="mt-1 pt-1 border-t border-dashed border-gray-200">
              <div className="text-xs text-gray-500 mb-1">연결된 노드</div>
              {childNodes.map(({ key, path: childPath }) => (
                <TreeNode
                  key={key}
                  node={structure.nodes[key]}
                  path={childPath}
                  onCopy={onCopy}
                  onPaste={onPaste}
                  onDelete={onDelete}
                  side={side}
                  otherSideHasData={otherSideHasData}
                  clipboard={clipboard}
                  structure={structure}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
