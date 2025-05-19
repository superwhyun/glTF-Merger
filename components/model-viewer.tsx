"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Play, Pause, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

interface ModelViewerProps {
  url: string
  modelStructure: any
  onSceneReady?: (scene: THREE.Scene) => void
  onAnimationsLoaded?: (animations: THREE.AnimationClip[]) => void
}

export function ModelViewer({ url, modelStructure, onSceneReady, onAnimationsLoaded }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [animations, setAnimations] = useState<THREE.AnimationClip[]>([])
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [hasAnimations, setHasAnimations] = useState(false)
  const [isModelLoaded, setIsModelLoaded] = useState(false)

  // Three.js 객체 참조 저장
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const clockRef = useRef<THREE.Clock | null>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const animationsRef = useRef<THREE.AnimationClip[]>([])
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const urlRef = useRef<string>(url)

  // 애니메이션 상태 ref (클로저 문제 해결)
  const isPlayingRef = useRef<boolean>(false)
  const animationProgressRef = useRef<number>(0)

  // 모델 구조 변경 감지를 위한 ref와 state
  const modelStructureRef = useRef<any>(null)
  const structureChangedRef = useRef<boolean>(false)

// modelStructure.animations가 바뀔 때 애니메이션 상태 동기화
useEffect(() => {
  if (modelStructure && Array.isArray(modelStructure.animations) && modelRef.current) {
    setAnimations(modelStructure.animations)
    animationsRef.current = modelStructure.animations
    setHasAnimations(modelStructure.animations.length > 0)
    if (modelStructure.animations.length > 0) {
      // AnimationMixer 재설정
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
        mixerRef.current.uncacheRoot(mixerRef.current.getRoot && mixerRef.current.getRoot())
      }
      const mixer = new THREE.AnimationMixer(modelRef.current)
      mixerRef.current = mixer
      // 첫 번째 애니메이션 자동 선택 및 재생
      setCurrentAnimation(modelStructure.animations[0].name)
      const action = mixer.clipAction(modelStructure.animations[0])
      action.reset()
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.enabled = true
      action.paused = false
      action.play()
      currentActionRef.current = action
      isPlayingRef.current = true
      setIsPlaying(true)
    }
  }
}, [modelStructure && modelStructure.animations])
  // 모델 구조가 변경되었는지 확인 (useEffect로 안전하게 처리)
  // 모델 구조 변경 감지로 인한 중복 loadModel 호출 방지 (비활성화)
  // useEffect(() => {
  //   if (!modelStructure) return
  //   // ... 이하 생략
  // }, [modelStructure])

  // 모델 로드 함수
  const loadModel = (modelUrl: string) => {
    if (!sceneRef.current) {
      console.warn("씬이 초기화되지 않았습니다.")
      return
    }

    const scene = sceneRef.current

    // 씬의 모든 자식(시스템 객체 제외) 완전 제거 및 dispose (while 패턴)
    const systemTypes = [
      "GridHelper", "DirectionalLight", "AmbientLight", "HemisphereLight", "PointLight", "SpotLight", "CameraHelper"
    ];
    let i = 0;
    while (i < scene.children.length) {
      const child = scene.children[i];
      if (!systemTypes.includes(child.type)) {
        scene.remove(child);
        if (child instanceof THREE.Object3D && typeof child.traverse === "function") {
          child.traverse((object: THREE.Object3D) => {
            if (object instanceof THREE.Mesh) {
              if (object.geometry) object.geometry.dispose()
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach((material: THREE.Material) => material.dispose())
                } else {
                  (object.material as THREE.Material).dispose()
                }
              }
            }
          })
        }
        // remove하면 children 배열이 줄어드므로, i를 증가시키지 않음
      } else {
        i++;
      }
    }

    // 이전 모델 제거 (기존 방식, 혹시 modelRef.current가 남아있을 경우)
    if (modelRef.current) {
      scene.remove(modelRef.current)
      if (modelRef.current instanceof THREE.Object3D && typeof modelRef.current.traverse === "function") {
        modelRef.current.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose()
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((material: THREE.Material) => material.dispose())
              } else {
                (object.material as THREE.Material).dispose()
              }
            }
          }
        })
      }
      modelRef.current = null
    }

    // 애니메이션 정리
    if (mixerRef.current) {
      mixerRef.current.stopAllAction()
      mixerRef.current.uncacheRoot(mixerRef.current.getRoot && mixerRef.current.getRoot())
      mixerRef.current = null
    }
    if (currentActionRef.current) {
      currentActionRef.current.stop()
      currentActionRef.current = null
    }
    animationsRef.current = []
    animationFrameRef.current = null

    // 애니메이션 상태 초기화
    setAnimations([])
    setCurrentAnimation(null)
    setIsPlaying(false)
    setHasAnimations(false)
    setAnimationProgress(0)
    
    // ref 상태도 초기화
    isPlayingRef.current = false
    animationProgressRef.current = 0

    // 모델 로더 설정
    const loader = new GLTFLoader()
    loader.register((parser: any) => new VRMLoaderPlugin(parser))

    console.log(`모델 로드 시작: ${modelUrl}`)

    // 모델 로드
    loader.load(
      modelUrl,
      (gltf: any) => {
        console.log("모델 로드 성공:", gltf)

        let model: THREE.Object3D

        // VRM 모델인 경우
        if (gltf.userData.vrm) {
          console.log("VRM 모델 감지됨")
          const vrm = gltf.userData.vrm
          VRMUtils.removeUnnecessaryJoints(vrm.scene)
          model = vrm.scene
        } else {
          // 일반 GLB 모델인 경우
          console.log("일반 GLB 모델 감지됨")
          model = gltf.scene
        }

        // 모델 참조 저장 (내보내기에 사용됨)
        modelRef.current = model

        // 모델에 이름 추가 (내보내기 식별용)
        model.name = "exportableModel"

        // 모델 크기 조정 및 위치 조정
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3()).length()
        const center = box.getCenter(new THREE.Vector3())
        console.log("[모델 bounding box size]", size)
        console.log("[모델 bounding box center]", center)
        if (cameraRef.current) {
          const cam = cameraRef.current;
          console.log("[카메라 fov]", cam.fov, "[aspect]", cam.aspect, "[near]", cam.near, "[far]", cam.far)
        }

        model.position.x = -center.x
        model.position.y = -center.y
        model.position.z = -center.z

        // 화면의 80%를 채우도록 카메라 거리 자동 조정
        model.scale.set(1, 1, 1)
        const boxSize = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z)
        const fitRatio = 0.8
        if (cameraRef.current) {
          const camera = cameraRef.current
          const fov = camera.fov * (Math.PI / 180)
          // 화면의 세로 기준으로 fit, aspect가 크면 가로도 고려
          const fitHeightDistance = (maxDim / fitRatio) / (2 * Math.tan(fov / 2))
          const fitWidthDistance = (maxDim / fitRatio) / (2 * Math.tan(fov / 2)) / camera.aspect
          const distance = Math.max(fitHeightDistance, fitWidthDistance)
          camera.position.copy(center)
          camera.position.x += distance
          camera.position.y += distance * 0.3 // 약간 위에서 내려다보는 각도
          camera.position.z += distance
          camera.lookAt(center)
          console.log("[카메라 fit distance]", distance)
        }
        console.log("[모델 scale]", 1)

        scene.add(model)

        // 카메라 위치 조정
        if (cameraRef.current) {
          const camera = cameraRef.current
          camera.position.copy(center)
          camera.position.x += size / 2.0
          camera.position.y += size / 5.0
          camera.position.z += size / 2.0
          camera.lookAt(center)
          console.log("[카메라 position]", camera.position)
        }

        // 새 모델 추가 후 잔상 제거를 위해 명시적으로 color/depth/stencil 모두 clear + render
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.clear(true, true, true);
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }

        // 애니메이션 설정
        console.log("모델 애니메이션:", gltf.animations)
        console.log("구조 애니메이션:", modelStructure?.animations)
        
        // GLTF에서 로드된 애니메이션과 구조 정보를 모두 모델 구조에 저장
        if (gltf.animations && gltf.animations.length > 0) {
          console.log(`${gltf.animations.length}개의 애니메이션 발견`)
          const anims = gltf.animations
          animationsRef.current = anims
          setAnimations(anims)
          setHasAnimations(true)

          // 애니메이션 믹서 생성
          const mixer = new THREE.AnimationMixer(model)
          mixerRef.current = mixer

          // 첫 번째 애니메이션 자동 선택
          setCurrentAnimation(anims[0].name)

          // 첫 번째 애니메이션 액션 생성 및 설정
          const action = mixer.clipAction(anims[0])
          action.reset()
          action.setLoop(THREE.LoopRepeat, Infinity) // 무한 반복 설정
          action.enabled = true
          action.paused = false
          action.play()
          currentActionRef.current = action
          
          // 상태 동기화
          isPlayingRef.current = true
          setIsPlaying(true)

          console.log(`첫 번째 애니메이션 '${anims[0].name}' 자동 재생 시작`)
          console.log("액션 상태:", {
            enabled: action.enabled,
            paused: action.paused,
            running: action.isRunning(),
            weight: action.weight
          })
        } else {
          console.log("애니메이션이 없는 모델")
          setHasAnimations(false)
        }

        // 상태 업데이트를 비동기적으로 처리하면서 애니메이션 데이터 동기화
        setTimeout(() => {
          setIsModelLoaded(true)
          
          // 애니메이션이 로드되었음을 부모 컴포넌트에 알림
          if (gltf.animations && gltf.animations.length > 0 && onAnimationsLoaded) {
            console.log("애니메이션 데이터를 부모 컴포넌트로 전달 중...")
            onAnimationsLoaded(gltf.animations)
          }
        }, 0)

        // 씬 구조 디버깅
        console.log("씬 구조:", scene)
        console.log("모델 참조:", modelRef.current)
      },
      (progress) => {
        console.log(`로딩 진행률: ${(progress.loaded / progress.total) * 100}%`)
      },
      (error) => {
        console.error("모델 로딩 오류:", error)
        setError(`모델 로딩 실패: ${error.message}`)
        setIsModelLoaded(false)
      },
    )
  }

  // 초기 씬 설정 - URL과 onSceneReady 의존성 제거하여 안정화
  useEffect(() => {
    if (!containerRef.current) return

    // 이전 애니메이션 프레임 정리
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // 렌더러 설정
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.innerHTML = "" // 기존 캔버스 제거
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 씬 설정 - 한 번만 생성되도록 보장
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf5f5f5)
    sceneRef.current = scene

    // 카메라 설정
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000,
    )
    camera.position.set(0, 1.5, 3)
    cameraRef.current = camera

    // 조명 설정
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // 컨트롤 설정
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // 그리드 헬퍼 추가
    const gridHelper = new THREE.GridHelper(10, 10)
    scene.add(gridHelper)

    // 시계 설정 (애니메이션용)
    const clock = new THREE.Clock()
    clockRef.current = clock

    // 씬이 준비되었음을 알림 - 초기 한 번만
    if (onSceneReady) {
      console.log("ModelViewer: 기본 씬 설정 완료, onSceneReady 콜백 호출", scene)
      onSceneReady(scene)
    }

    // 애니메이션 루프
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)

      // 애니메이션 업데이트 - Clock.getDelta()를 항상 호출해야 함
      if (mixerRef.current && clockRef.current) {
        const delta = clockRef.current.getDelta()
        
        // ref를 통해 최신 재생 상태 확인
        const currentIsPlaying = isPlayingRef.current
        const currentAction = currentActionRef.current
        
        // 재생 중이고 일시정지되지 않은 경우에만 믹서 업데이트
        if (currentIsPlaying && currentAction && !currentAction.paused) {
          mixerRef.current.update(delta)

          // 현재 애니메이션 진행 상태 업데이트
          const duration = currentAction.getClip().duration
          if (duration > 0) {
            const progress = (currentAction.time / duration) * 100
            const normalizedProgress = progress % 100
            
            // ref 업데이트
            animationProgressRef.current = normalizedProgress
            // React state 업데이트 (리렌더링 트리거)
            setAnimationProgress(normalizedProgress)
          }
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    // 창 크기 변경 이벤트 처리
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return

      const camera = cameraRef.current
      const renderer = rendererRef.current

      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }

    window.addEventListener("resize", handleResize)

    // 정리 함수
    return () => {
      window.removeEventListener("resize", handleResize)

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      if (containerRef.current && rendererRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement)
        } catch (e) {
          console.warn("캔버스 제거 중 오류:", e)
        }
      }

      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current)

        // 메모리 정리
        // traverse 호출 전 Object3D 타입 체크 및 에러 핸들링
        if (modelRef.current instanceof THREE.Object3D && typeof modelRef.current.traverse === "function") {
          modelRef.current.traverse((object: THREE.Object3D) => {
            if (object instanceof THREE.Mesh) {
              if (object.geometry) object.geometry.dispose()
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach((material: THREE.Material) => material.dispose())
                } else {
                  (object.material as THREE.Material).dispose()
                }
              }
            }
          })
        } else if (modelRef.current) {
          // traverse가 없거나 Object3D가 아닌 경우: 미지원 포맷 또는 파싱 실패
          console.error("모델 로딩 실패: 지원하지 않는 파일 포맷이거나, Object3D가 아님.", modelRef.current)
          alert("모델 로딩 실패: 지원하지 않는 파일 포맷이거나, Three.js에서 파싱할 수 없는 모델입니다.\nGLTF/GLB/VRM 파일만 지원합니다.")
        }
      }

      if (rendererRef.current) {
        rendererRef.current.dispose()
      }

      // 애니메이션 정리
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
      }
    }
  }, []) // 의존성 배열을 빈 배열로 변경

  // 초기 모델 로드를 위한 별도 useEffect
  useEffect(() => {
    if (sceneRef.current && url) {
      urlRef.current = url
      loadModel(url)
    }
  }, [url])

  // onSceneReady 콜백을 위한 별도 useEffect
  useEffect(() => {
    if (sceneRef.current && onSceneReady) {
      console.log("ModelViewer: onSceneReady 콜백 업데이트됨")
      onSceneReady(sceneRef.current)
    }
  }, [onSceneReady])

  // 애니메이션 변경 처리
  useEffect(() => {
    if (!mixerRef.current || !currentAnimation || !hasAnimations) return

    const currentIsPlaying = isPlayingRef.current
    console.log(`애니메이션 변경: ${currentAnimation}, 현재 재생 상태: ${currentIsPlaying}`)

    // 현재 실행 중인 애니메이션 정지
    if (currentActionRef.current) {
      currentActionRef.current.stop()
    }

    // 선택한 애니메이션 찾기
    const clip = animationsRef.current.find((anim: THREE.AnimationClip) => anim.name === currentAnimation)
    if (!clip) {
      console.warn(`애니메이션 '${currentAnimation}'을 찾을 수 없습니다.`)
      return
    }

    console.log(`애니메이션 클립 찾음: ${clip.name}, 길이: ${clip.duration}초`)

    // 새 애니메이션 액션 생성 및 실행
    const action = mixerRef.current.clipAction(clip)
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity) // 무한 반복 설정
    action.enabled = true
    
    // 현재 재생 상태에 따라 액션 시작
    if (currentIsPlaying) {
      action.paused = false
      action.play()
      console.log(`애니메이션 '${clip.name}' 재생 시작`)
    } else {
      action.paused = true
      action.play() // play 한 후 paused로 설정하면 첫 프레임에서 정지
      console.log(`애니메이션 '${clip.name}' 첫 프레임에서 정지`)
    }

    currentActionRef.current = action
    
    // 상태 동기화
    animationProgressRef.current = 0
    setAnimationProgress(0) // 진행률 초기화
  }, [currentAnimation, hasAnimations]) // isPlaying 의존성 제거하여 무한 루프 방지

  // 재생/일시정지 토글
  const togglePlay = () => {
    if (!currentActionRef.current || !mixerRef.current) {
      console.warn("애니메이션 액션이 설정되지 않았습니다.")
      return
    }

    const action = currentActionRef.current
    const wasPlaying = isPlayingRef.current

    console.log(`현재 애니메이션 상태:`, {
      isPlaying: wasPlaying,
      actionPaused: action.paused,
      actionRunning: action.isRunning(),
      actionTime: action.time,
      actionWeight: action.weight,
      actionEnabled: action.enabled
    })

    if (wasPlaying) {
      // 일시정지
      action.paused = true
      isPlayingRef.current = false
      setIsPlaying(false)
      console.log("애니메이션 일시정지됨")
    } else {
      // 재생
      action.paused = false
      action.enabled = true
      if (!action.isRunning()) {
        action.play()
      }
      isPlayingRef.current = true
      setIsPlaying(true)
      console.log("애니메이션 재생 시작")
    }
  }

  // 애니메이션 리셋
  const resetAnimation = () => {
    if (!currentActionRef.current) {
      console.warn("애니메이션 액션이 설정되지 않았습니다.")
      return
    }

    console.log("애니메이션 리셋")
    const action = currentActionRef.current
    
    action.stop()
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.play()
    
    // 상태 동기화
    isPlayingRef.current = true
    animationProgressRef.current = 0
    setAnimationProgress(0)
    setIsPlaying(true)
  }

  // 애니메이션 진행 상태 변경
  const handleProgressChange = (value: number[]) => {
    if (!currentActionRef.current || !mixerRef.current) {
      console.warn("애니메이션 액션이 설정되지 않았습니다.")
      return
    }

    const progress = value[0]
    const action = currentActionRef.current
    const duration = action.getClip().duration
    const targetTime = (progress / 100) * duration
    
    console.log(`슬라이더 이동 - 진행률: ${progress}%, 시간: ${targetTime}/${duration}초`)
    
    // ref를 통해 최신 재생 상태 확인
    const wasPlaying = isPlayingRef.current
    const wasPaused = action.paused
    
    // 액션 시간 설정
    action.time = targetTime
    
    // 상태 동기화
    animationProgressRef.current = progress
    setAnimationProgress(progress)
    
    // 재생 상태 복원
    if (wasPlaying && !wasPaused) {
      action.paused = false
      action.enabled = true
      if (!action.isRunning()) {
        action.play()
      }
    }
    
    // 즉시 프레임 업데이트를 위해 믹서를 수동으로 업데이트
    mixerRef.current.update(0)
    
    console.log(`슬라이더 이동 후 상태:`, {
      isPlaying: wasPlaying,
      actionPaused: action.paused,
      actionRunning: action.isRunning(),
      actionTime: action.time
    })
  }

  return (
    <div className="w-full h-full relative flex flex-col">
      {error ? (
        <Alert variant="destructive" className="absolute inset-0 flex items-center">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>렌더링 오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div ref={containerRef} className="w-full flex-grow" />

          {/* 애니메이션 컨트롤 */}
          {hasAnimations && (
            <div className="p-2 bg-gray-50 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={togglePlay}
                  disabled={!currentAnimation}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={resetAnimation}
                  disabled={!currentAnimation}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                <select
                  value={currentAnimation || ""}
                  onChange={(e) => {
                    const value = e.target.value
                    console.log(`애니메이션 선택: ${value}`)
                    setCurrentAnimation(value)
                  }}
                  className="h-8 flex-grow px-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">애니메이션 선택</option>
                  {animations.map((anim) => (
                    <option key={anim.name} value={anim.name}>
                      {anim.name}
                    </option>
                  ))}
                </select>

                {/* 디버깅용 상태 표시 */}
                <div className="text-xs text-gray-500 ml-2">
                  {currentActionRef.current && (
                    <span>
                      {isPlaying ? (currentActionRef.current.paused ? "⏸️" : "▶️") : "⏹️"}
                    </span>
                  )}
                </div>
              </div>

              <Slider
                value={[animationProgress]}
                min={0}
                max={100}
                step={0.1}
                onValueChange={handleProgressChange}
                className="my-1"
              />
              
              {/* 진행률 텍스트 표시 */}
              <div className="text-xs text-gray-500 text-center">
                {animationProgress.toFixed(1)}%
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
