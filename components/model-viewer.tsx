"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { VRMLoaderPlugin, VRMUtils, VRM } from "@pixiv/three-vrm"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Play, Pause, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { GLTFDocumentManager } from "@/lib/gltf-document-manager"

interface ModelViewerProps {
  url: string
  modelStructure: any
  onSceneReady?: (scene: THREE.Scene) => void
  onAnimationsLoaded?: (animations: THREE.AnimationClip[]) => void
  onVRMLoaded?: (vrm: VRM | null, vrmData?: any) => void
  onDocumentManagerReady?: (manager: any) => void // GLTFDocumentManager 타입 임시 any로 변경
}

export function ModelViewer({ url, modelStructure, onSceneReady, onAnimationsLoaded, onVRMLoaded, onDocumentManagerReady }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [animations, setAnimations] = useState<THREE.AnimationClip[]>([])
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState<number>(-1)
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
  // VRM 참조 추가
  const vrmRef = useRef<VRM | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const urlRef = useRef<string>(url)

  // GLTFDocumentManager 추가 (임시 비활성화)
  // const documentManagerRef = useRef<GLTFDocumentManager | null>(null)
  const documentManagerRef = useRef<any>(null)

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
      setCurrentAnimationIndex(0)
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

  // 모델 로드 함수 - 기존 방식 유지
  const loadModel = async (modelUrl: string) => {
    if (!sceneRef.current) {
      console.warn("씬이 초기화되지 않았습니다.")
      return
    }

    const scene = sceneRef.current

    // 기존 DocumentManager 정리 (임시 비활성화)
    // if (documentManagerRef.current) {
    //   documentManagerRef.current.dispose()
    //   documentManagerRef.current = null
    // }

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

    // 기존 모델 정리
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    // 애니메이션 정리
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    if (currentActionRef.current) {
      currentActionRef.current.stop();
      currentActionRef.current = null;
    }

    // 상태 초기화
    setAnimations([]);
    setCurrentAnimationIndex(-1);
    setIsPlaying(false);
    setHasAnimations(false);
    setAnimationProgress(0);
    isPlayingRef.current = false;
    animationProgressRef.current = 0;

    try {
      console.log(`모델 로드 시작: ${modelUrl}`);
      
      // 파일 다운로드
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], modelUrl.split('/').pop() || 'model.glb');
      
      console.log('다운로드된 파일:', file.name, file.size, file.type);

      // 1. Three.js GLTFLoader로 실제 모델 로드 (화면 표시용)
      console.log('Three.js GLTFLoader로 모델 로드...');
      const loader = new GLTFLoader()
      
      // VRM 지원을 위한 플러그인 추가
      loader.register((parser) => {
        return new VRMLoaderPlugin(parser)
      })

      // 모델 로드
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          modelUrl,
          (loadedGltf) => resolve(loadedGltf),
          undefined,
          (error) => reject(error)
        )
      })

      console.log('Three.js 로드 성공:', gltf);

      // 2. 백그라운드에서 GLTFDocumentManager로 Document 로드 (내보내기용)
      try {
        console.log('🟡 [LOAD] 백그라운드에서 GLTFDocumentManager Document 로드 시도...');
        const manager = new GLTFDocumentManager();
        await manager.loadFromFile(file);

        // VRM 확장 정보를 extras에 반영
        const root = manager.getDocument().getRoot();
        const vrmExt = root.getExtension("VRMC_vrm");
        const vrmMetaExt = root.getExtension("VRMC_vrm_meta");
        if (vrmExt || vrmMetaExt) {
          root.setExtras({
            ...root.getExtras(),
            vrm: vrmExt || null,
            vrmMetadata: vrmMetaExt || null,
          });
          console.log("🟢 [LOAD] VRM 확장 정보를 extras에 반영 완료:", root.getExtras());
        }

        documentManagerRef.current = manager;
        console.log('🟢 [LOAD] GLTFDocumentManager Document 로드 성공!');
        console.log('🟢 [LOAD] Document:', manager.getDocument());
        
        // DocumentManager를 부모 컴포넌트에 전달
        if (onDocumentManagerReady) {
          console.log('🟢 [LOAD] DocumentManager를 부모 컴포넌트에 전달');
          onDocumentManagerReady(manager);
        }
      } catch (docError) {
        console.warn('🔴 [LOAD] GLTFDocumentManager Document 로드 실패:', docError);
        documentManagerRef.current = null;
        console.log('🔴 [LOAD] documentManagerRef가 null로 설정됨 - Three.js 방식으로만 동작');
      }

      // VRM 데이터 확인
      let vrm: VRM | null = null
      if (gltf.userData?.vrm) {
        vrm = gltf.userData.vrm
        console.log('VRM 데이터 발견:', vrm)
        
        // VRM humanoid 정보 출력
        if (vrm.humanoid) {
          console.log('VRM Humanoid 본 정보:', vrm.humanoid.normalizedHumanBones)
        }

        // VRM의 정확한 위치 설정 (필요시)
        VRMUtils.rotateVRM0(vrm)

        // VRM 참조 저장
        vrmRef.current = vrm

        // VRM 데이터를 부모에 전달
        if (onVRMLoaded) {
          onVRMLoaded(vrm, {
            title: vrm.meta?.title || '제목 없음',
            author: vrm.meta?.author || '작성자 불명',
            version: vrm.meta?.version || '버전 불명'
          })
        }
      } else {
        vrmRef.current = null
        if (onVRMLoaded) {
          onVRMLoaded(null)
        }
      }

      // 씬에 모델 추가
      const model = gltf.scene
      model.name = 'exportableModel' // 내보내기를 위한 이름 설정
      scene.add(model)
      modelRef.current = model

      // 모델 크기 조정 및 위치 조정
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3()).length()
      const center = box.getCenter(new THREE.Vector3())

      // 카메라 위치 조정
      if (cameraRef.current) {
        const camera = cameraRef.current
        camera.position.copy(center)
        camera.position.x += size / 2.0
        camera.position.y += size / 5.0
        camera.position.z += size / 2.0
        camera.lookAt(center)
      }

      // 애니메이션 처리
      if (gltf.animations && gltf.animations.length > 0) {
        console.log(`${gltf.animations.length}개의 애니메이션 발견:`)
        gltf.animations.forEach((anim: THREE.AnimationClip, index: number) => {
          console.log(`  ${index}: ${anim.name} (${anim.duration.toFixed(2)}초)`)
        })

        setAnimations(gltf.animations)
        animationsRef.current = gltf.animations
        setHasAnimations(true)

        if (onAnimationsLoaded) {
          onAnimationsLoaded(gltf.animations)
        }

        // AnimationMixer 설정
        const mixer = new THREE.AnimationMixer(model)
        mixerRef.current = mixer

        // 첫 번째 애니메이션 자동 재생
        if (gltf.animations.length > 0) {
          setCurrentAnimationIndex(0)
          const action = mixer.clipAction(gltf.animations[0])
          action.reset()
          action.setLoop(THREE.LoopRepeat, Infinity)
          action.enabled = true
          action.paused = false
          action.play()
          currentActionRef.current = action
          isPlayingRef.current = true
          setIsPlaying(true)
          console.log(`첫 번째 애니메이션 '${gltf.animations[0].name}' 자동 재생 시작`)
        }
      } else {
        console.log('애니메이션이 없습니다.')
        setAnimations([])
        setHasAnimations(false)
        if (onAnimationsLoaded) {
          onAnimationsLoaded([])
        }
      }

      setIsModelLoaded(true)
      console.log('모델 로드 완료')

    } catch (error) {
      console.error("모델 로딩 오류:", error)
      setError(`모델 로딩 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      setIsModelLoaded(false)
    }
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

      // VRM 업데이트 (필요한 경우)
      if (vrmRef.current) {
        vrmRef.current.update(clockRef.current?.getDelta() || 0)
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
    if (!mixerRef.current || currentAnimationIndex < 0 || !hasAnimations) return

    const currentIsPlaying = isPlayingRef.current
    console.log(`애니메이션 변경: 인덱스 ${currentAnimationIndex}, 현재 재생 상태: ${currentIsPlaying}`)

    // 현재 실행 중인 애니메이션 정지
    if (currentActionRef.current) {
      currentActionRef.current.stop()
    }

    // 선택한 애니메이션 가져오기
    const clip = animationsRef.current[currentAnimationIndex]
    if (!clip) {
      console.warn(`애니메이션 인덱스 ${currentAnimationIndex}을 찾을 수 없습니다.`)
      // 애니메이션 목록 로그 출력
      console.log("사용 가능한 애니메이션 목록:", animationsRef.current.map((a, i) => `${i}: ${a.name}`))
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
  }, [currentAnimationIndex, hasAnimations]) // isPlaying 의존성 제거하여 무한 루프 방지

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
                  disabled={currentAnimationIndex < 0}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={resetAnimation}
                  disabled={currentAnimationIndex < 0}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                <select
                  value={currentAnimationIndex}
                  onChange={(e) => {
                    const index = parseInt(e.target.value)
                    console.log(`애니메이션 선택: 인덱스 ${index}`)
                    setCurrentAnimationIndex(index)
                  }}
                  className="h-8 flex-grow px-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value={-1}>애니메이션 선택</option>
                  {animations.map((anim, index) => (
                    <option key={`${anim.name}-${index}`} value={index}>
                      {anim.name} {animations.filter(a => a.name === anim.name).length > 1 ? `(${index + 1})` : ''}
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
