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
      
      // 원본 JSON 데이터 파싱 (확장 보존용)
      const originalJson = await this.parseOriginalJson(uint8Array);
      
      // WebIO로 읽기 시도
      this.document = await this.io.readBinary(uint8Array);
      
      // VRM 및 기타 확장 데이터 검증 및 보존
      await this.preserveAllExtensions(originalJson);
      
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

          // 모든 extensions 및 extras를 root extras로 복사 (확장 가시성/디버깅용)
          const allExtras: any = {};
          for (const ext of root.listExtensionsUsed()) {
            const extName = ext.extensionName;
            const instance = root.getExtension(extName);
            if (instance) {
              try {
                allExtras[extName] = JSON.parse(JSON.stringify(instance));
              } catch (e) {
                console.warn(`🔶 ${extName} 직렬화 실패:`, e);
              }
            }
          }
          root.setExtras({
            ...root.getExtras(),
            ...allExtras
          });
          console.log('🟢 모든 확장 데이터를 Root Extras에 복사 완료:', root.getExtras());
        
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

      // 실제 사용된 확장 목록 확인
      const activeExtensions = this.getAllActiveExtensions();
      console.log("🟢 실제 사용된 확장 목록 (노드/머티리얼 등 포함):", activeExtensions);
      
      return {
        document: this.document,
        threeScene: this.threeScene
      };
    } catch (error) {
      console.error('glTF Document 로드 실패:', error);
      throw error;
    }
  }

  /**
   * 원본 JSON 데이터 파싱 (확장 보존용)
   */
  private async parseOriginalJson(uint8Array: Uint8Array): Promise<any> {
    try {
      // GLB 헤더 확인
      const magic = new Uint32Array(uint8Array.buffer, 0, 1)[0];
      if (magic === 0x46546C67) { // 'glTF' magic
        // GLB 포맷: JSON chunk 추출
        const version = new Uint32Array(uint8Array.buffer, 4, 1)[0];
        const length = new Uint32Array(uint8Array.buffer, 8, 1)[0];
        const chunkLength = new Uint32Array(uint8Array.buffer, 12, 1)[0];
        const chunkType = new Uint32Array(uint8Array.buffer, 16, 1)[0];
        
        if (chunkType === 0x4E4F534A) { // 'JSON' chunk
          const jsonStart = 20;
          const jsonEnd = jsonStart + chunkLength;
          const jsonBytes = uint8Array.slice(jsonStart, jsonEnd);
          const jsonString = new TextDecoder().decode(jsonBytes);
          return JSON.parse(jsonString);
        }
      }
      return null;
    } catch (error) {
      console.warn('🟡 [PARSE] 원본 JSON 파싱 실패:', error);
      return null;
    }
  }

  /**
   * 모든 확장 데이터를 보존하는 함수
   */
  private async preserveAllExtensions(originalJson?: any): Promise<void> {
    if (!this.document) return;

    const root = this.document.getRoot();
    console.log('🟢 [PRESERVE] 확장 보존 시작');
    
    try {
      let originalExtensions = {};
      let originalExtrasRoot = {};
      
      if (originalJson) {
        originalExtensions = originalJson.extensions || {};
        originalExtrasRoot = originalJson.extras || {};
        console.log('🟢 [PRESERVE] 원본 확장:', Object.keys(originalExtensions));
        console.log('🟢 [PRESERVE] 원본 Extras:', originalExtrasRoot);
        
        // VRM 관련 extensions 특별 처리
        const vrmExtensions = ['VRM', 'VRMC_vrm', 'VRMC_springBone', 'VRMC_materials_mtoon', 'VRMC_materials_hdr_emissiveMultiplier', 'VRMC_node_constraint'];
        vrmExtensions.forEach(extName => {
          if (originalExtensions[extName]) {
            console.log(`🟢 [PRESERVE] VRM 확장 발견: ${extName}`, originalExtensions[extName]);
          }
        });
      }
      
      // Root에 모든 확장 데이터를 extras로 보존
      const currentExtras = root.getExtras() || {};
      root.setExtras({
        ...currentExtras,
        originalExtensions,
        originalExtras: originalExtrasRoot
      });
      
      // 각 노드의 확장 정보도 보존
      if (originalJson?.nodes) {
        root.listNodes().forEach((node, index) => {
          const originalNode = originalJson.nodes[index];
          if (originalNode?.extensions || originalNode?.extras) {
            const nodeExtras = node.getExtras() || {};
            node.setExtras({
              ...nodeExtras,
              originalExtensions: originalNode.extensions || {},
              originalExtras: originalNode.extras || {}
            });
            
            // VRM 관련 노드 extensions 로깅
            if (originalNode.extensions) {
              Object.keys(originalNode.extensions).forEach(extName => {
                if (extName.startsWith('VRM') || extName.startsWith('VRMC_')) {
                  console.log(`🟢 [PRESERVE] 노드 ${index} VRM 확장: ${extName}`);
                }
              });
            }
          }
        });
      }
      
      // 머티리얼 확장 정보도 보존
      if (originalJson?.materials) {
        root.listMaterials().forEach((material, index) => {
          const originalMaterial = originalJson.materials[index];
          if (originalMaterial?.extensions || originalMaterial?.extras) {
            const materialExtras = material.getExtras() || {};
            material.setExtras({
              ...materialExtras,
              originalExtensions: originalMaterial.extensions || {},
              originalExtras: originalMaterial.extras || {}
            });
            
            // VRM 관련 머티리얼 extensions 로깅
            if (originalMaterial.extensions) {
              Object.keys(originalMaterial.extensions).forEach(extName => {
                if (extName.startsWith('VRM') || extName.startsWith('VRMC_')) {
                  console.log(`🟢 [PRESERVE] 머티리얼 ${index} VRM 확장: ${extName}`);
                }
              });
            }
          }
        });
      }
      
      console.log('🟢 [PRESERVE] 확장 보존 완료');
    } catch (error) {
      console.warn('🟡 [PRESERVE] 확장 보존 중 오류:', error);
    }
  }

  /**
   * 실제로 장면 그래프 내부에서 사용된 확장 목록 수집
   */
  getAllActiveExtensions(): string[] {
    if (!this.document) return [];

    const found = new Set<string>();
    const root = this.document.getRoot();
    const declared = root.listExtensionsUsed().map(ext => ext.extensionName);

    console.log('🟢 [EXTENSIONS] 선언된 확장:', declared);

    const checkExtensions = (obj: any, objType: string = 'unknown') => {
      for (const extName of declared) {
        if (obj.getExtension && obj.getExtension(extName)) {
          found.add(extName);
          console.log(`🟢 [EXTENSIONS] ${objType}에서 ${extName} 발견`);
        }
      }
      
      // extras에서 originalExtensions도 확인
      const extras = obj.getExtras && obj.getExtras();
      if (extras?.originalExtensions) {
        Object.keys(extras.originalExtensions).forEach(extName => {
          found.add(extName);
          console.log(`🟢 [EXTENSIONS] ${objType} extras에서 ${extName} 발견`);
        });
      }
    };

    // Root 확장 확인
    checkExtensions(root, 'root');
    
    // 각 객체 타입별 확장 확인
    root.listScenes().forEach((scene, i) => checkExtensions(scene, `scene-${i}`));
    root.listNodes().forEach((node, i) => checkExtensions(node, `node-${i}`));
    root.listMeshes().forEach((mesh, i) => checkExtensions(mesh, `mesh-${i}`));
    root.listMaterials().forEach((material, i) => checkExtensions(material, `material-${i}`));
    root.listTextures().forEach((texture, i) => checkExtensions(texture, `texture-${i}`));
    root.listAnimations().forEach((animation, i) => checkExtensions(animation, `animation-${i}`));
    root.listAccessors().forEach((accessor, i) => checkExtensions(accessor, `accessor-${i}`));
    root.listBuffers().forEach((buffer, i) => checkExtensions(buffer, `buffer-${i}`));

    const result = Array.from(found);
    console.log('🟢 [EXTENSIONS] 최종 발견된 확장:', result);
    return result;
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
   * Document 변경사항을 Three.js에서 로드 가능한 URL로 변환
   */
  async getUpdatedModelURL(): Promise<string> {
    try {
      const glbBuffer = await this.exportToGLB()
      const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' })
      const url = URL.createObjectURL(blob)
      console.log('🟢 [MANAGER] Updated model URL created:', url)
      return url
    } catch (error) {
      console.error('🔴 [MANAGER] Failed to generate updated model URL:', error)
      throw error
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
      
      // 현재 확장 상태 확인
      const root = this.document.getRoot();
      console.log('🟡 [EXPORT] - 선언된 확장:', root.listExtensionsUsed().map(e => e.extensionName));
      console.log('🟡 [EXPORT] - 필수 확장:', root.listExtensionsRequired().map(e => e.extensionName));
      console.log('🟡 [EXPORT] - Root extras 키들:', Object.keys(root.getExtras() || {}));

      // Export 전에 모든 확장 데이터 복원
      await this.restoreAllExtensions();
      
      // 복원 후 상태 재확인
      console.log('🟡 [EXPORT] 복원 후 - 선언된 확장:', root.listExtensionsUsed().map(e => e.extensionName));
      console.log('🟡 [EXPORT] 복원 후 - Root extras 키들:', Object.keys(root.getExtras() || {}));

      const arrayBuffer = await this.io.writeBinary(this.document, {
        includeCustomExtensions: true,
        format: 'glb'
      });
      console.log('🟢 [EXPORT] gltf-transform 내보내기 성공, 크기:', arrayBuffer.byteLength, 'bytes');
      
      return arrayBuffer;
    } catch (error) {
      console.error('🔴 [EXPORT] gltf-transform 내보내기 실패:', error);
      throw error;
    }
  }

  /**
   * 저장된 확장 데이터를 Document에 복원
   */
  private async restoreAllExtensions(): Promise<void> {
    if (!this.document) return;

    const root = this.document.getRoot();
    const rootExtras = root.getExtras();
    
    if (!rootExtras?.originalExtensions) {
      console.log('🟡 [RESTORE] 복원할 확장 데이터가 없습니다.');
      return;
    }

    console.log('🟢 [RESTORE] 확장 데이터 복원 시작');
    console.log('🟢 [RESTORE] 복원할 확장들:', Object.keys(rootExtras.originalExtensions));
    
    try {
      const originalExtensions = rootExtras.originalExtensions;
      
      // 1. Document JSON에 직접 extensions 설정
      const jsonDoc = this.document.getGraph().getLinks().find(link => 
        link.getChild()?.constructor?.name === 'JSONDocument'
      )?.getChild() as any;
      
      if (jsonDoc && jsonDoc.json) {
        // Root level extensions 설정
        if (!jsonDoc.json.extensions) {
          jsonDoc.json.extensions = {};
        }
        
        // 원본 extensions를 직접 복사
        Object.assign(jsonDoc.json.extensions, originalExtensions);
        
        // extensionsUsed에 추가
        if (!jsonDoc.json.extensionsUsed) {
          jsonDoc.json.extensionsUsed = [];
        }
        
        Object.keys(originalExtensions).forEach(extName => {
          if (!jsonDoc.json.extensionsUsed.includes(extName)) {
            jsonDoc.json.extensionsUsed.push(extName);
          }
        });
        
        // VRM extensions는 required로 설정
        if (!jsonDoc.json.extensionsRequired) {
          jsonDoc.json.extensionsRequired = [];
        }
        
        Object.keys(originalExtensions).forEach(extName => {
          if ((extName.startsWith('VRM') || extName.startsWith('VRMC_')) && 
              !jsonDoc.json.extensionsRequired.includes(extName)) {
            jsonDoc.json.extensionsRequired.push(extName);
          }
        });
        
        console.log('🟢 [RESTORE] Document JSON에 extensions 직접 설정:', Object.keys(originalExtensions));
        console.log('🟢 [RESTORE] extensionsUsed:', jsonDoc.json.extensionsUsed);
        console.log('🟢 [RESTORE] extensionsRequired:', jsonDoc.json.extensionsRequired);
      } else {
        console.warn('🟡 [RESTORE] JSON Document 접근 실패, 대체 방법 사용');
        
        // 대체 방법: Root extras에 설정
        const newExtras = {
          ...rootExtras,
          ...originalExtensions,
          originalExtensions: rootExtras.originalExtensions,
          originalExtras: rootExtras.originalExtras
        };
        
        root.setExtras(newExtras);
      }

      // 2. 각 노드의 확장도 복원
      root.listNodes().forEach((node, index) => {
        const nodeExtras = node.getExtras();
        if (nodeExtras?.originalExtensions) {
          const nodeNewExtras = {
            ...nodeExtras,
            ...nodeExtras.originalExtensions
          };
          node.setExtras(nodeNewExtras);
          console.log(`🟢 [RESTORE] 노드 ${index} 확장 복원`);
        }
      });

      // 3. 머티리얼 확장도 복원
      root.listMaterials().forEach((material, index) => {
        const materialExtras = material.getExtras();
        if (materialExtras?.originalExtensions) {
          const materialNewExtras = {
            ...materialExtras,
            ...materialExtras.originalExtensions
          };
          material.setExtras(materialNewExtras);
          console.log(`🟢 [RESTORE] 머티리얼 ${index} 확장 복원`);
        }
      });
      
      console.log('🟢 [RESTORE] 모든 확장 데이터 복원 완료');
    } catch (error) {
      console.warn('🟡 [RESTORE] 확장 복원 중 오류:', error);
      
      // 실패 시 최소한 extras에는 보존
      const fallbackExtras = {
        ...rootExtras,
        extensions: rootExtras.originalExtensions,
        extras: rootExtras.originalExtras
      };
      root.setExtras(fallbackExtras);
      console.log('🟡 [RESTORE] 폴백: extras에 확장 데이터 보존');
    }
  }

/**
   * Document 구조를 JSON으로 변환 (디버깅/UI용)
   */
  getDocumentStructure(): any {
    return this.getGLTFJSONStructure();
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

  /**
   * glTF 포맷에 맞는 전체 JSON 구조 반환
   */
  getGLTFJSONStructure(): any {
    const doc = this.document as Document;
    if (!doc || typeof doc.getAsset !== "function") {
      console.warn("❌ getGLTFJSONStructure: document 타입 확인 필요:", doc);
      return null;
    }

    const root = doc.getRoot();
    const json: any = {
      asset: doc.getAsset(),
      extensionsUsed: root.listExtensionsUsed().map(ext => ext.extensionName),
      extensionsRequired: root.listExtensionsRequired().map(ext => ext.extensionName),
      extensions: {},
      scenes: [], // 필요한 경우 구현
      nodes: [],  // 필요한 경우 구현
    };

    for (const ext of root.listExtensionsUsed()) {
      const name = ext.extensionName;
      const instance = root.getExtension(name);
      if (instance) {
        try {
          json.extensions[name] = JSON.parse(JSON.stringify(instance));
        } catch (e) {
          console.warn(`Extension ${name} 직렬화 실패:`, e);
        }
      }
    }

    return json;
  }
}

// %%%%%LAST%%%%%