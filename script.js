(function () {
  const THREE = window.THREE;
  const link = document.querySelector('.sign-link');
  const canvasHost = document.querySelector('.sign-canvas');
  const sceneElement = document.querySelector('.scene');
  const shadowElement = document.querySelector('.sign-shadow');
  const glareElement = document.querySelector('.sign-glare');

  if (!THREE || !link || !canvasHost || !sceneElement || !shadowElement || !glareElement) {
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
  let targetDepth = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let entryBiasTargetX = 0;
  let entryBiasTargetY = 0;
  let entryBiasX = 0;
  let entryBiasY = 0;

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

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 6.7);

  scene.add(new THREE.AmbientLight(0xf7efe1, 1.7));

  const keyLight = new THREE.DirectionalLight(0xfff4de, 1.2);
  keyLight.position.set(-1.4, 1.8, 3.4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa36a31, 0.7);
  rimLight.position.set(2.2, -1, -2.8);
  scene.add(rimLight);

  const signRig = new THREE.Group();
  const signGroup = new THREE.Group();
  signRig.add(signGroup);
  signRig.position.y = 0.02;
  scene.add(signRig);

  const revealEuler = new THREE.Euler(0, Math.PI, Math.PI / 2, 'YXZ');
  const frontQuaternion = new THREE.Quaternion();
  const rearQuaternion = new THREE.Quaternion().setFromEuler(revealEuler);
  const targetQuaternion = new THREE.Quaternion();

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

  function createRearTexture(image) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const rearArtScale = 1.14;
    const canvas = document.createElement('canvas');

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create 2D context for rear texture.');
    }

    context.translate(canvas.width / 2, canvas.height / 2);

    const scale = Math.min(canvas.height / sourceWidth, canvas.width / sourceHeight);
    const drawWidth = sourceWidth * scale * rearArtScale;
    const drawHeight = sourceHeight * scale * rearArtScale;

    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    return configureTexture(new THREE.CanvasTexture(canvas));
  }

  function setRevealed(nextValue) {
    revealed = nextValue;
    targetQuaternion.copy(revealed ? rearQuaternion : frontQuaternion);
    targetDepth = revealed ? 0.9 : 0;
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

  function updatePointerTargets(event) {
    const bounds = sceneElement.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width;
    const py = (event.clientY - bounds.top) / bounds.height;

    pointerTargetX = (px - 0.5) * 2;
    pointerTargetY = (py - 0.5) * 2;
  }

  function bindInteraction() {
    if (hoverCapable) {
      link.addEventListener('pointermove', function (event) {
        updatePointerTargets(event);
      });

      link.addEventListener('mouseenter', function (event) {
        updatePointerTargets(event);
        entryBiasTargetX = pointerTargetX;
        entryBiasTargetY = pointerTargetY;
        setRevealed(true);
      });

      link.addEventListener('mouseleave', function () {
        setRevealed(false);
        pointerTargetX = 0;
        pointerTargetY = 0;
        entryBiasTargetX = 0;
        entryBiasTargetY = 0;
      });

      link.addEventListener('focus', function () {
        entryBiasTargetX = 0;
        entryBiasTargetY = 0;
        setRevealed(true);
      });

      link.addEventListener('blur', function () {
        setRevealed(false);
        entryBiasTargetX = 0;
        entryBiasTargetY = 0;
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

      event.preventDefault();
      window.clearTimeout(revealTimeout);
      window.location.href = link.href;
    });
  }

  function buildSign(frontTexture, rearTexture) {
    const signWidth = 3.3;
    const signHeight = signWidth / (3300 / 2550);
    const planeGeometry = new THREE.PlaneGeometry(signWidth, signHeight);
    const faceOffset = 0.002;

    const frontFace = new THREE.Mesh(
      planeGeometry,
      new THREE.MeshBasicMaterial({
        map: frontTexture,
        side: THREE.FrontSide
      })
    );
    frontFace.position.z = faceOffset;
    signGroup.add(frontFace);

    const rearFace = new THREE.Mesh(
      planeGeometry,
      new THREE.MeshBasicMaterial({
        map: rearTexture,
        side: THREE.FrontSide
      })
    );
    rearFace.rotation.y = Math.PI;
    rearFace.position.z = -faceOffset;
    signGroup.add(rearFace);
  }

  function animate() {
    const clock = new THREE.Clock();
    const baseTilt = THREE.MathUtils.degToRad(-2);

    targetQuaternion.copy(frontQuaternion);

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.05);
      const damping = prefersReducedMotion ? 1 : 1 - Math.exp(-delta * 7.2);
      const pointerDamping = prefersReducedMotion ? 1 : 1 - Math.exp(-delta * 5.2);
      const entryDamping = prefersReducedMotion ? 1 : 1 - Math.exp(-delta * 6.6);

      THREE.Quaternion.slerp(signGroup.quaternion, targetQuaternion, signGroup.quaternion, damping);
      pointerX = THREE.MathUtils.lerp(pointerX, pointerTargetX, pointerDamping);
      pointerY = THREE.MathUtils.lerp(pointerY, pointerTargetY, pointerDamping);
      entryBiasX = THREE.MathUtils.lerp(entryBiasX, entryBiasTargetX, entryDamping);
      entryBiasY = THREE.MathUtils.lerp(entryBiasY, entryBiasTargetY, entryDamping);

      const revealAmount = THREE.MathUtils.clamp(signRig.position.z / 0.9, 0, 1);
      const entryInfluence = (1 - revealAmount) * (revealed ? 1 : 0.35);

      const pointerTiltX = pointerY * 0.11;
      const pointerTiltY = -pointerX * 0.11;
      const entryTiltX = entryBiasY * -0.12 * entryInfluence;
      const entryTiltY = entryBiasX * -0.14 * entryInfluence;

      if (prefersReducedMotion) {
        signRig.rotation.x = baseTilt + pointerTiltX + entryTiltX;
      } else {
        signRig.rotation.x = baseTilt + Math.sin(clock.elapsedTime * 0.8) * 0.03 + pointerTiltX + entryTiltX;
      }

      signRig.rotation.y = pointerTiltY + entryTiltY;
      signRig.rotation.z = pointerX * -0.025 + entryBiasX * -0.035 * entryInfluence;
      signRig.position.x = entryBiasX * -0.16 * entryInfluence;
      signRig.position.y = 0.02 + entryBiasY * 0.1 * entryInfluence;

      signRig.position.z = THREE.MathUtils.lerp(signRig.position.z, targetDepth, damping);

      const shadowX = pointerX * 32;
      const shadowY = 18 + pointerY * 24 + (revealed ? 18 : 0);
      const shadowScale = revealed ? 0.98 : 1.08;
      const shadowOpacity = revealed ? 0.8 : 0.48;
      shadowElement.style.transform =
        'translate(' + shadowX.toFixed(2) + 'px, ' + shadowY.toFixed(2) + 'px) scale(' + shadowScale.toFixed(3) + ')';
      shadowElement.style.opacity = shadowOpacity.toFixed(3);

      const glareX = -pointerX * 24 + entryBiasX * 12 * entryInfluence;
      const glareY = -pointerY * 16 - (revealed ? 6 : 0);
      const glareRotate = -12 + pointerX * -4 + entryBiasX * -3 * entryInfluence;
      const glareScale = revealed ? 0.84 : 0.74;
      const glareOpacity = revealed ? 0.34 : 0.2;
      glareElement.style.transform =
        'translate(' + glareX.toFixed(2) + 'px, ' + glareY.toFixed(2) + 'px) rotate(' + glareRotate.toFixed(2) + 'deg) scale(' + glareScale.toFixed(3) + ')';
      glareElement.style.opacity = glareOpacity.toFixed(3);

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
    const rearTexture = createRearTexture(images[1]);

    buildSign(frontTexture, rearTexture);
    canvasHost.classList.add('has-three');
    link.classList.add('has-three-ready');
    bindInteraction();
    link.dataset.revealed = 'false';
    resize();
    window.addEventListener('resize', resize);
    animate();

    window.setTimeout(function () {
      sceneElement.classList.add('is-visible');
    }, 900);
  }).catch(function (error) {
    console.error(error);
  });
})();
