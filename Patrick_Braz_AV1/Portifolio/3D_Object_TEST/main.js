import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

// --- Variáveis Globais ---
// ... (sem mudanças aqui) ...
let scene, camera, renderer, controls;
let geometry, material, mesh;
let ambientLight, directionalLight;
let lightHelper;
let dragControls;
let currentGeometryType = 'sphere';


// --- Elementos da UI ---
// ... (sem mudanças aqui) ...
const container = document.getElementById('container');
const geometryTypeSelect = document.getElementById('geometryType');
const diameterSlider = document.getElementById('diameter');
const diameterValueSpan = document.getElementById('diameterValue');
const segmentsSlider = document.getElementById('segments');
const segmentsValueSpan = document.getElementById('segmentsValue');
const colorPicker = document.getElementById('color'); // Cor do Objeto
const wireframeCheckbox = document.getElementById('wireframe');
const shadingSelect = document.getElementById('shading');
const lightIntensitySlider = document.getElementById('lightIntensity');
const lightIntensityValueSpan = document.getElementById('lightIntensityValue');
const lightColorPicker = document.getElementById('lightColor'); // Cor da Luz
const autoRotateCheckbox = document.getElementById('autoRotate');
const rotateXSlider = document.getElementById('rotateX');
const rotateXValueSpan = document.getElementById('rotateXValue');
const rotateYSlider = document.getElementById('rotateY');
const rotateYValueSpan = document.getElementById('rotateYValue');
const rotateZSlider = document.getElementById('rotateZ');
const rotateZValueSpan = document.getElementById('rotateZValue');


// --- Função para Normalizar Cor --- <<<<<<<<<<<<<<<<<<<<<<<<< NOVA FUNÇÃO AUXILIAR
function normalizeColor(color) {
    const normalizedColor = color.clone(); // Não modificar o original diretamente
    const maxComponent = Math.max(normalizedColor.r, normalizedColor.g, normalizedColor.b);
    if (maxComponent > 0) {
        // Divide pelo componente máximo para que o mais brilhante se torne 1.0
        normalizedColor.multiplyScalar(1 / maxComponent);
    }
    // Se maxComponent for 0 (preto), a cor permanece preta.
    return normalizedColor;
}

// --- Inicialização ---
function init() {
    // ... (Cena, Câmera, Renderer como antes) ...
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);


    // Luzes
    ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Reduzir um pouco a ambiente para ver melhor a direcional
    scene.add(ambientLight);

    // <<< Pega a cor inicial, normaliza e aplica >>>
    const initialLightColorHex = lightColorPicker.value;
    const initialLightColor = new THREE.Color(initialLightColorHex);
    const normalizedInitialLightColor = normalizeColor(initialLightColor); // Normaliza

    directionalLight = new THREE.DirectionalLight(
        normalizedInitialLightColor, // Usa a cor NORMALIZADA
        parseFloat(lightIntensitySlider.value) // Intensidade vem do slider
    );
    directionalLight.position.set(5, 5, 5).normalize().multiplyScalar(5);
    scene.add(directionalLight);

    // ... (Light Helper, Material, Geometria, Controles Orbit/Drag como antes) ...
    const lightHelperGeometry = new THREE.SphereGeometry(0.15);
    const lightHelperMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    lightHelper = new THREE.Mesh(lightHelperGeometry, lightHelperMaterial);
    lightHelper.position.copy(directionalLight.position);
    scene.add(lightHelper);

    material = new THREE.MeshStandardMaterial({
        color: colorPicker.value,
        wireframe: wireframeCheckbox.checked,
        metalness: 0.1,
        roughness: 0.5,
    });

    createGeometry();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;

    const draggableObjects = [lightHelper];
    dragControls = new DragControls(draggableObjects, camera, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; /* ... */ });
    dragControls.addEventListener('drag', function (event) { directionalLight.position.copy(event.object.position); });
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; /* ... */ });


    // --- Event Listeners ---
    // ... (Listeners para geometry, diameter, segments, objectColor, wireframe, shading, autoRotate, rotationSliders como antes) ...
    geometryTypeSelect.addEventListener('change', handleGeometryChange);
    diameterSlider.addEventListener('input', handleDiameterChange);
    segmentsSlider.addEventListener('input', handleSegmentsChange);
    colorPicker.addEventListener('input', handleObjectColorChange);
    wireframeCheckbox.addEventListener('change', handleWireframeChange);
    shadingSelect.addEventListener('change', handleShadingChange);
    lightIntensitySlider.addEventListener('input', handleLightIntensityChange); // <<< Este controla a INTENSIDADE
    lightColorPicker.addEventListener('input', handleLightColorChange);       // <<< Este controla a COR (agora normalizada)
    autoRotateCheckbox.addEventListener('change', () => {}); // Só para saber que existe
    rotateXSlider.addEventListener('input', handleRotationChange);
    rotateYSlider.addEventListener('input', handleRotationChange);
    rotateZSlider.addEventListener('input', handleRotationChange);


    window.addEventListener('resize', onWindowResize);

    updateShadingControlState();
    updateRotationSlidersFromMesh();
    animate();
}

// --- Funções de Criação/Atualização da Geometria ---
// ... (createGeometry como antes) ...
function createGeometry() {
    if (mesh) {
        scene.remove(mesh);
        geometry.dispose();
    }
    const diameter = parseFloat(diameterSlider.value);
    const radius = diameter / 2;
    const segments = parseInt(segmentsSlider.value);
    currentGeometryType = geometryTypeSelect.value;
    const currentRotation = mesh ? mesh.rotation.clone() : new THREE.Euler();

    switch (currentGeometryType) { /* ... casos ... */
        case 'box': geometry = new THREE.BoxGeometry(diameter, diameter, diameter, segments, segments, segments); break;
        case 'cylinder': geometry = new THREE.CylinderGeometry(radius, radius, diameter, segments, Math.max(1, Math.floor(segments / 4))); break;
        case 'torus': const tubeRadius = radius * 0.3; geometry = new THREE.TorusGeometry(radius, tubeRadius, Math.max(3, Math.floor(segments / 2)), segments); break;
        case 'icosahedron': const detail = Math.max(0, Math.floor(segments / 5)); geometry = new THREE.IcosahedronGeometry(radius, detail); break;
        case 'sphere': default: geometry = new THREE.SphereGeometry(radius, segments, Math.max(2, Math.floor(segments / 2))); break;
    }
     if (currentGeometryType === 'box') segmentsSlider.labels[0].textContent = "Detalhe/Segmentos:";
     else if (currentGeometryType === 'cylinder') segmentsSlider.labels[0].textContent = "Detalhe Radial:";
     else if (currentGeometryType === 'torus') segmentsSlider.labels[0].textContent = "Detalhe Tubular:";
     else if (currentGeometryType === 'icosahedron') segmentsSlider.labels[0].textContent = "Subdivisões:";
     else segmentsSlider.labels[0].textContent = "Detalhe/Faces:";


    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.copy(currentRotation);
    scene.add(mesh);
    updateRotationSlidersFromMesh();
}


// --- Handlers de Eventos da UI ---

// ... (handleGeometryChange, handleDiameterChange, handleSegmentsChange, handleObjectColorChange,
//      handleWireframeChange, handleShadingChange, handleRotationChange,
//      updateRotationSlidersFromMesh, updateShadingControlState como antes) ...

function handleGeometryChange() { createGeometry(); handleDiameterChange(); handleSegmentsChange(); }
function handleDiameterChange() { const diameter = parseFloat(diameterSlider.value); diameterValueSpan.textContent = diameter.toFixed(1); createGeometry(); }
function handleSegmentsChange() { const segments = parseInt(segmentsSlider.value); segmentsValueSpan.textContent = segments; createGeometry(); }
function handleObjectColorChange() { material.color.set(colorPicker.value); }
function handleWireframeChange() { material.wireframe = wireframeCheckbox.checked; updateShadingControlState(); }
function handleShadingChange() { if (material) { material.flatShading = (shadingSelect.value === 'flat'); material.needsUpdate = true; } }
function handleRotationChange() { if (!mesh) return; const rotX = THREE.MathUtils.degToRad(parseFloat(rotateXSlider.value)); const rotY = THREE.MathUtils.degToRad(parseFloat(rotateYSlider.value)); const rotZ = THREE.MathUtils.degToRad(parseFloat(rotateZSlider.value)); mesh.rotation.set(rotX, rotY, rotZ); rotateXValueSpan.textContent = rotateXSlider.value; rotateYValueSpan.textContent = rotateYSlider.value; rotateZValueSpan.textContent = rotateZSlider.value; }
function updateRotationSlidersFromMesh() { if (!mesh) return; const rotXDeg = THREE.MathUtils.radToDeg(mesh.rotation.x); const rotYDeg = THREE.MathUtils.radToDeg(mesh.rotation.y); const rotZDeg = THREE.MathUtils.radToDeg(mesh.rotation.z); rotateXSlider.value = rotXDeg.toFixed(0); rotateYSlider.value = rotYDeg.toFixed(0); rotateZSlider.value = rotZDeg.toFixed(0); rotateXValueSpan.textContent = rotateXSlider.value; rotateYValueSpan.textContent = rotateYSlider.value; rotateZValueSpan.textContent = rotateZSlider.value; }
function updateShadingControlState() { shadingSelect.disabled = wireframeCheckbox.checked; if (!wireframeCheckbox.checked) { handleShadingChange(); } }


// <<< Handler de Intensidade da Luz (Controla APENAS a intensidade) >>>
function handleLightIntensityChange() {
    const intensity = parseFloat(lightIntensitySlider.value);
    directionalLight.intensity = intensity; // Define a propriedade intensity
    lightIntensityValueSpan.textContent = intensity.toFixed(1);
}

// <<< Handler de Cor da Luz (Normaliza a cor e a define) >>>
function handleLightColorChange() {
    const selectedColor = new THREE.Color(lightColorPicker.value);
    const normalizedColor = normalizeColor(selectedColor); // Normaliza
    directionalLight.color.set(normalizedColor); // Define a propriedade color com a cor normalizada
    // A intensidade NÃO é alterada aqui.
}


// --- Redimensionamento da Janela ---
// ... (onWindowResize como antes) ...
function onWindowResize() { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); }


// --- Loop de Animação ---
// ... (animate como antes) ...
function animate() { requestAnimationFrame(animate); controls.update(); if (autoRotateCheckbox.checked && mesh) { mesh.rotation.x += 0.005; mesh.rotation.y += 0.005; /* updateRotationSlidersFromMesh(); */ } renderer.render(scene, camera); }

// --- Inicia a aplicação ---
init();