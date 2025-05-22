import { Document, WebIO, Node, Mesh, Scene, Accessor, Buffer } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';

/**
 * glTF-Transform Document와 Three.js Scene을 동시에 관리하는 클래스
 * 양방향 동기화와 고급 편집 기능을 제공
 */
export class GLTFDocumentManager {
  private document: Document | null = null;
  private io: WebIO;
  private threeScene: THREE.Scene | null = null;
  private nodeMap = new Map<string, { gltfNode: Node; threeObject: THREE.Object3D }>();
  
  constructor() {
    this.io = new WebIO()
      .registerExtensions(ALL_EXTENSIONS)
      .setVertexLayout({ POSITION: 'FLOAT32', NORMAL: 'FLOAT32', TEXCOORD_0: 'FLOAT32' });
  }

  /**
   * 파일에서 glTF Document를 로드
   */
  async loadFromFile(file: File): Promise<{ document: Document; threeScene: THREE.Scene }> {
    try {
      console.log('파일 정보:', file.name, file.size, file.type);
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer 크기:', arrayBuffer.byteLength);
      
      // ArrayBuffer를 Uint8Array로 변환
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log('Uint8Array 첫 4바이트:', Array.from(uint8Array.slice(0, 4)));
      
      // WebIO로 읽기 시도 - unknown extensions 보존 설정
      this.document = await this.io.readBinary(uint8Array);
      
      console.log('🟢 glTF-Transform Document 로드 성공:', this.document);
      console.log('🟢 - 노드 수:', this.document.getRoot().listNodes().length);
      console.log('🟢 - 메시 수:', this.document.getRoot().listMeshes().length);
      console.log('🟢 - 머티리얼 수:', this.document.getRoot().listMaterials().length);
      console.log('🟢 - 텍스처 수:', this.document.getRoot().listTextures().length);
      // 확장 정보 확인
      console.log('🟢 - 확장 목록:', this.document.getRoot().listExtensionsUsed());
      console.log('🟢 - 필수 확장:', this.document.getRoot().listExtensionsRequired());
      
      // Document의 JSON 데이터 직접 확인 (VRM 확장 포함)
      try {
        const graph = this.document.getGraph();
        console.log('🟢 - Document Graph 존재:', !!graph);
        
        // Root에서 확장 데이터 확인
        const root = this.document.getRoot();
        const rootExtras = root.getExtras();
        console.log('🟢 - Root Extras:', rootExtras);
        
        // Scene에서 VRM 관련 데이터 확인
        const scenes = root.listScenes();
        if (scenes.length > 0) {
          console.log('🟢 - Scene[0] Extras:', scenes[0].getExtras());
        }
      } catch (extError) {
        console.warn('🟡 확장 데이터 확인 중 오류:', extError);
      }
      
      // 텍스처 정보 상세 출력
      const textures = this.document.getRoot().listTextures();
      // textures.forEach((texture, index) => {
      //   console.log(`🟢 텍스처 ${index}:`, {
      //     name: texture.getName(),
      //     mimeType: texture.getMimeType(),
      //     size: texture.getSize()
      //   });
      // });
      
      // 머티리얼 정보 상세 출력
      const materials = this.document.getRoot().listMaterials();
      // materials.forEach((material, index) => {
      //   console.log(`🟢 머티리얼 ${index}:`, {
      //     name: material.getName(),
      //     baseColorTexture: !!material.getBaseColorTexture(),
      //     normalTexture: !!material.getNormalTexture(),
      //     metallicRoughnessTexture: !!material.getMetallicRoughnessTexture()
      //   });
      // });
      
      console.log('glTF-Transform Document 로드 성공:', this.document);
      console.log('- 노드 수:', this.document.getRoot().listNodes().length);
      console.log('- 메시 수:', this.document.getRoot().listMeshes().length);
      console.log('- 애니메이션 수:', this.document.getRoot().listAnimations().length);
      
      // Three.js Scene 생성
      this.threeScene = await this.createThreeScene();
      
      return {
        document: this.document,
        threeScene: this.threeScene
      };
    } catch (error) {
      console.error('glTF Document 로드 실패:', error);
      throw error;
    }
  }

// %%%%%LAST%%%%%
  /**
   * glTF Document에서 Three.js Scene 생성
   */
  private async createThreeScene(): Promise<THREE.Scene> {
    if (!this.document) {
      throw new Error('Document가 로드되지 않았습니다.');
    }

    const scene = new THREE.Scene();
    this.nodeMap.clear();
    
    // 루트 노드들을 Three.js 객체로 변환
    const rootNodes = this.document.getRoot().listScenes()[0]?.listChildren() || [];
    
    for (const gltfNode of rootNodes) {
      const threeObject = await this.convertNodeToThree(gltfNode);
      if (threeObject) {
        scene.add(threeObject);
      }
    }
    
    return scene;
  }

  /**
   * glTF Node를 Three.js Object3D로 변환
   */
  private async convertNodeToThree(gltfNode: Node): Promise<THREE.Object3D | null> {
    const threeObject = new THREE.Group();
    threeObject.name = gltfNode.getName() || `Node_${gltfNode.listParents().length}`;
    
    // Transform 적용
    const translation = gltfNode.getTranslation();
    const rotation = gltfNode.getRotation();
    const scale = gltfNode.getScale();
    
    if (translation) threeObject.position.fromArray(translation);
    if (rotation) threeObject.quaternion.fromArray(rotation);
    if (scale) threeObject.scale.fromArray(scale);
    
    // 메시가 있는 경우 처리
    const mesh = gltfNode.getMesh();
    if (mesh) {
      // 간단한 메시 생성 (실제로는 더 복잡한 변환 필요)
      const geometry = new THREE.BoxGeometry(1, 1, 1); // 임시 지오메트리
      const material = new THREE.MeshBasicMaterial({ color: 0x888888 });
      const threeMesh = new THREE.Mesh(geometry, material);
      threeMesh.name = mesh.getName() || 'Mesh';
      threeObject.add(threeMesh);
    }
    
    // 매핑 정보 저장
    this.nodeMap.set(threeObject.uuid, {
      gltfNode: gltfNode,
      threeObject: threeObject
    });
    
    // 자식 노드들 재귀 처리
    for (const childNode of gltfNode.listChildren()) {
      const childThreeObject = await this.convertNodeToThree(childNode);
      if (childThreeObject) {
        threeObject.add(childThreeObject);
      }
    }
    
    return threeObject;
  }

/**
   * 노드 복사
   */
  copyNode(sourceNodeUuid: string): Node | null {
    const mapping = this.nodeMap.get(sourceNodeUuid);
    if (!mapping || !this.document) {
      return null;
    }
    
    return mapping.gltfNode.clone();
  }

  /**
   * 노드를 다른 부모로 이동
   */
  moveNode(nodeUuid: string, targetParentUuid: string): boolean {
    const nodeMapping = this.nodeMap.get(nodeUuid);
    const parentMapping = this.nodeMap.get(targetParentUuid);
    
    if (!nodeMapping || !parentMapping || !this.document) {
      return false;
    }
    
    try {
      // glTF Document에서 이동
      const currentParent = nodeMapping.gltfNode.getParent();
      if (currentParent && currentParent instanceof Node) {
        currentParent.removeChild(nodeMapping.gltfNode);
      }
      parentMapping.gltfNode.addChild(nodeMapping.gltfNode);
      
      // Three.js Scene에서도 이동
      if (nodeMapping.threeObject.parent) {
        nodeMapping.threeObject.parent.remove(nodeMapping.threeObject);
      }
      parentMapping.threeObject.add(nodeMapping.threeObject);
      
      console.log(`노드 이동 성공: ${nodeMapping.gltfNode.getName()} → ${parentMapping.gltfNode.getName()}`);
      return true;
    } catch (error) {
      console.error('노드 이동 실패:', error);
      return false;
    }
  }

  /**
   * 노드 삭제
   */
  deleteNode(nodeUuid: string): boolean {
    const mapping = this.nodeMap.get(nodeUuid);
    if (!mapping || !this.document) {
      return false;
    }
    
    try {
      // glTF Document에서 삭제
      const parent = mapping.gltfNode.getParent();
      if (parent && parent instanceof Node) {
        parent.removeChild(mapping.gltfNode);
      } else if (parent && parent instanceof Scene) {
        parent.removeChild(mapping.gltfNode);
      }
      
      // Three.js Scene에서도 삭제
      if (mapping.threeObject.parent) {
        mapping.threeObject.parent.remove(mapping.threeObject);
      }
      
      // 매핑에서 제거
      this.nodeMap.delete(nodeUuid);
      
      console.log(`노드 삭제 성공: ${mapping.gltfNode.getName()}`);
      return true;
    } catch (error) {
      console.error('노드 삭제 실패:', error);
      return false;
    }
  }

/**
   * 노드의 Transform 업데이트
   */
  updateNodeTransform(nodeUuid: string, transform: {
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  }): boolean {
    const mapping = this.nodeMap.get(nodeUuid);
    if (!mapping) {
      return false;
    }
    
    try {
      // glTF Document 업데이트
      if (transform.position) {
        mapping.gltfNode.setTranslation(transform.position);
        mapping.threeObject.position.fromArray(transform.position);
      }
      if (transform.rotation) {
        mapping.gltfNode.setRotation(transform.rotation);
        mapping.threeObject.quaternion.fromArray(transform.rotation);
      }
      if (transform.scale) {
        mapping.gltfNode.setScale(transform.scale);
        mapping.threeObject.scale.fromArray(transform.scale);
      }
      
      return true;
    } catch (error) {
      console.error('Transform 업데이트 실패:', error);
      return false;
    }
  }

  /**
   * glTF 파일로 내보내기
   */
  async exportToGLB(): Promise<Uint8Array> {
    if (!this.document) {
      throw new Error('Document가 없습니다.');
    }
    
    try {
      console.log('🟡 [EXPORT] gltf-transform Document 내보내기 시작');
      console.log('🟡 [EXPORT] 내보낼 Document 정보:');
      console.log('🟡 [EXPORT] - 노드 수:', this.document.getRoot().listNodes().length);
      console.log('🟡 [EXPORT] - 메시 수:', this.document.getRoot().listMeshes().length);
      console.log('🟡 [EXPORT] - 머티리얼 수:', this.document.getRoot().listMaterials().length);
      console.log('🟡 [EXPORT] - 텍스처 수:', this.document.getRoot().listTextures().length);

      // Export 전에 Root extras를 재설정하여 누락 방지
      const root = this.document.getRoot();
      const extras = root.getExtras();
      if (extras?.vrm || extras?.vrmMetadata) {
        root.setExtras({
          ...extras,
          vrm: extras.vrm,
          vrmMetadata: extras.vrmMetadata,
        });
        console.log('🟢 [EXPORT] Root extras 재설정 완료:', root.getExtras());
      }

      const arrayBuffer = await this.io.writeBinary(this.document);
      console.log('🟢 [EXPORT] gltf-transform 내보내기 성공, 크기:', arrayBuffer.byteLength, 'bytes');
      
      return arrayBuffer;
    } catch (error) {
      console.error('🔴 [EXPORT] gltf-transform 내보내기 실패:', error);
      throw error;
    }
  }

/**
   * Document 구조를 JSON으로 변환 (디버깅/UI용)
   */
  getDocumentStructure(): any {
    if (!this.document) {
      return null;
    }
    
    const structure = {
      scenes: this.document.getRoot().listScenes().map(scene => ({
        name: scene.getName(),
        nodes: scene.listChildren().map(node => this.nodeToStructure(node))
      })),
      animations: this.document.getRoot().listAnimations().map(anim => ({
        name: anim.getName(),
        duration: anim.listChannels().length > 0 ? 
          Math.max(...anim.listChannels().map(ch => 
            Math.max(...ch.getSampler()?.getInput()?.getArray() || [0])
          )) : 0
      })),
      meshes: this.document.getRoot().listMeshes().map(mesh => ({
        name: mesh.getName(),
        primitives: mesh.listPrimitives().length
      }))
    };
    
    return structure;
  }

  /**
   * 노드를 구조 객체로 변환 (재귀)
   */
  private nodeToStructure(node: Node): any {
    return {
      name: node.getName(),
      translation: node.getTranslation(),
      rotation: node.getRotation(),
      scale: node.getScale(),
      mesh: node.getMesh()?.getName(),
      children: node.listChildren().map(child => this.nodeToStructure(child))
    };
  }

  /**
   * Three.js 객체에서 glTF Node 찾기
   */
  getGLTFNodeByThreeObject(threeObject: THREE.Object3D): Node | null {
    const mapping = this.nodeMap.get(threeObject.uuid);
    return mapping ? mapping.gltfNode : null;
  }

  /**
   * glTF Node에서 Three.js 객체 찾기
   */
  getThreeObjectByGLTFNode(gltfNode: Node): THREE.Object3D | null {
    for (const [uuid, mapping] of this.nodeMap) {
      if (mapping.gltfNode === gltfNode) {
        return mapping.threeObject;
      }
    }
    return null;
  }

  /**
   * 현재 Document 반환
   */
  getDocument(): Document | null {
    return this.document;
  }

  /**
   * 현재 Three.js Scene 반환
   */
  getThreeScene(): THREE.Scene | null {
    return this.threeScene;
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.document = null;
    this.threeScene = null;
    this.nodeMap.clear();
  }
}

// %%%%%LAST%%%%%