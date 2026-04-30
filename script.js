(function () {
  const THREE = window.THREE;
  const link = document.querySelector('.sign-link');
  const canvasHost = document.querySelector('.sign-canvas');

  if (!THREE || !link || !canvasHost) {
    return;
  }

  // Direct file:// loads are unreliable for WebGL texture setup across browsers.
  // Keep the CSS fallback in that case instead of showing a broken black plane.
  if (window.location.protocol === 'file:') {
    return;
  }

  const hoverCapable = window.matchMedia('(hover: hover)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let revealed = false;
  let revealTimeout = null;
  let targetRotation = 0;

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if ('outputEncoding' in renderer && 'sRGBEncoding' in THREE) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  canvasHost.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 4.9);

  scene.add(new THREE.AmbientLight(0xf7efe1, 1.7));

  const keyLight = new THREE.DirectionalLight(0xfff4de, 1.2);
  keyLight.position.set(-1.4, 1.8, 3.4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa36a31, 0.7);
  rimLight.position.set(2.2, -1, -2.8);
  scene.add(rimLight);

  const signGroup = new THREE.Group();
  scene.add(signGroup);

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.decoding = 'async';
      image.addEventListener('load', function () {
        resolve(image);
      });
      image.addEventListener('error', function () {
        reject(new Error('Failed to load image: ' + src));
      });
      image.src = src;
    });
  }

  function configureTexture(texture) {
    if ('encoding' in texture && 'sRGBEncoding' in THREE) {
      texture.encoding = THREE.sRGBEncoding;
    }

    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function createTextureFromImage(image) {
    return configureTexture(new THREE.Texture(image));
  }

  function createRotatedRearTexture(image) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const canvas = document.createElement('canvas');

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create 2D context for rear texture.');
    }

    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(Math.PI / 2);

    const scale = Math.min(canvas.height / sourceWidth, canvas.width / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;

    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    return configureTexture(new THREE.CanvasTexture(canvas));
  }

  function setRevealed(nextValue) {
    revealed = nextValue;
    targetRotation = revealed ? Math.PI : 0;
    link.dataset.revealed = revealed ? 'true' : 'false';
  }

  function scheduleReset() {
    window.clearTimeout(revealTimeout);
    revealTimeout = window.setTimeout(function () {
      setRevealed(false);
    }, 4500);
  }

  function resize() {
    const width = canvasHost.clientWidth;
    const height = canvasHost.clientHeight;

    if (!width || !height) {
      return;
    }

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function bindInteraction() {
    if (hoverCapable) {
      link.addEventListener('mouseenter', function () {
        setRevealed(true);
      });

      link.addEventListener('mouseleave', function () {
        setRevealed(false);
      });

      link.addEventListener('focus', function () {
        setRevealed(true);
      });

      link.addEventListener('blur', function () {
        setRevealed(false);
      });
      return;
    }

    link.addEventListener('click', function (event) {
      if (!revealed) {
        event.preventDefault();
        setRevealed(true);
        scheduleReset();
        return;
      }

      window.clearTimeout(revealTimeout);
    });
  }

  function buildSign(frontTexture, rearTexture) {
    const signWidth = 3.3;
    const signHeight = signWidth / (3300 / 2550);
    const signDepth = 0.08;
    const faceOffset = signDepth / 2 + 0.002;

    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe7dcc8,
      roughness: 0.62,
      metalness: 0.08
    });
    const hiddenFaceMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0
    });

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(signWidth, signHeight, signDepth),
      [
        edgeMaterial,
        edgeMaterial,
        edgeMaterial,
        edgeMaterial,
        hiddenFaceMaterial,
        hiddenFaceMaterial
      ]
    );
    signGroup.add(body);

    const faceGeometry = new THREE.PlaneGeometry(signWidth * 0.992, signHeight * 0.992);

    const frontFace = new THREE.Mesh(
      faceGeometry,
      new THREE.MeshBasicMaterial({
        map: frontTexture,
        transparent: true,
        side: THREE.DoubleSide
      })
    );
    frontFace.position.z = faceOffset;
    signGroup.add(frontFace);

    const rearFace = new THREE.Mesh(
      faceGeometry,
      new THREE.MeshBasicMaterial({
        map: rearTexture,
        transparent: true,
        side: THREE.DoubleSide
      })
    );
    rearFace.rotation.y = Math.PI;
    rearFace.position.z = -faceOffset;
    signGroup.add(rearFace);
  }

  function animate() {
    const clock = new THREE.Clock();
    const baseTilt = THREE.MathUtils.degToRad(-2);

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.05);
      const damping = prefersReducedMotion ? 1 : 1 - Math.exp(-delta * 8);

      signGroup.rotation.y = THREE.MathUtils.lerp(signGroup.rotation.y, targetRotation, damping);

      if (prefersReducedMotion) {
        signGroup.rotation.x = baseTilt;
      } else {
        signGroup.rotation.x = baseTilt + Math.sin(clock.elapsedTime * 0.8) * 0.025;
      }

      renderer.render(scene, camera);
      window.requestAnimationFrame(tick);
    }

    window.requestAnimationFrame(tick);
  }

  Promise.all([
    loadImage('front.png'),
    loadImage('rear.png')
  ]).then(function (images) {
    const frontTexture = createTextureFromImage(images[0]);
    const rearTexture = createRotatedRearTexture(images[1]);

    buildSign(frontTexture, rearTexture);
    canvasHost.classList.add('has-three');
    link.classList.add('has-three-ready');
    bindInteraction();
    link.dataset.revealed = 'false';
    resize();
    window.addEventListener('resize', resize);
    animate();
  }).catch(function (error) {
    console.error(error);
  });
})();
