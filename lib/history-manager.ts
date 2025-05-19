export type ModelAction = {
  type: "copy" | "paste" | "delete" | "replace"
  targetSide: "left" | "right"
  path: string[]
  prevState: any
  newState: any
  description: string
}

export class HistoryManager {
  private history: ModelAction[] = []
  private currentIndex = -1
  private maxHistoryLength = 50

  constructor(maxHistoryLength = 50) {
    this.maxHistoryLength = maxHistoryLength
  }

  addAction(action: ModelAction): void {
    // 현재 인덱스 이후의 기록은 모두 삭제 (새 작업 후에는 redo 불가)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1)
    }

    // 히스토리에 새 작업 추가
    this.history.push(action)
    this.currentIndex++

    // 최대 히스토리 길이 유지
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift()
      this.currentIndex--
    }
  }

  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  undo(): ModelAction | null {
    if (!this.canUndo()) return null

    const action = this.history[this.currentIndex]
    this.currentIndex--
    return action
  }

  redo(): ModelAction | null {
    if (!this.canRedo()) return null

    this.currentIndex++
    return this.history[this.currentIndex]
  }

  getLastAction(): ModelAction | null {
    if (this.currentIndex < 0) return null
    return this.history[this.currentIndex]
  }

  clear(): void {
    this.history = []
    this.currentIndex = -1
  }
}
