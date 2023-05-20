import {
  ExtendedObject3D,
  PointerDrag,
  PointerLock,
  THREE,
  ThirdPersonControls,
} from "enable3d";
import { memo, useCallback, useEffect, useRef } from "react";
import { stateStorage, useTriggerState } from "react-trigger-state";
import type { ICharacter } from "./interface";

const Character = memo(({ name, isMainCharacter, asset }: ICharacter) => {
  // TODO: add resize event to update the camera
  const [isTouchDevice] = useTriggerState({ name: "is_touch_device" });
  const [create] = useTriggerState({ name: "main_scene_create" });
  const [scene] = useTriggerState({ name: "scene" });

  const lastFall = useRef(0);

  const handleCharacter = useCallback(async () => {
    if (scene == null) return;
    const currChars = stateStorage.get("all_characters");

    // if the character already exists, don't create it again
    if (currChars?.[name] != null) return;
    // add the character to the all_characters object
    stateStorage.set("all_characters", {
      ...currChars,
      [name]: true,
    });
    const { load, add, camera, animationMixers, physics, canvas } = scene;

    const object = await load.gltf(asset);
    const characterObj = object.scene.children[0];

    scene.character = new ExtendedObject3D();
    scene.character.name = name;
    scene.character.rotateY(Math.PI + 0.1); // a hack
    scene.character.add(characterObj);

    scene.character.rotation.set(0, Math.PI * 1.5, 0);
    scene.character.position.set(35, 0, 0);
    // add shadow
    scene.character.traverse((child: any) => {
      if (child.isMesh != null) child.castShadow = child.receiveShadow = true;
    });

    /**
     * Animations
     */
    // ad the box man's animation mixer to the animationMixers array (for auto updates)
    animationMixers.add(scene.character.animation.mixer);

    object.animations.forEach((animation: any) => {
      if (animation.name != null) {
        animation.timeScale = -0e55;
        scene.character.animation.add(animation.name, animation);
      }
    });

    console.log(scene.character.animation.get("idle"));
    scene.character.animation.play("idle");

    /**
     * Add the player to the scene with a body
     */
    add.existing(scene.character);
    physics.add.existing(scene.character, {
      shape: "sphere",
      mass: 1,
      radius: 0.25,
      width: 0.5,
      offset: { y: -0.25 },
    });

    scene.character.body.setFriction(1);
    scene.character.body.setAngularFactor(0, 0, 0);

    // https://docs.panda3d.org/1.10/python/programming/physics/bullet/ccd
    scene.character.body.setCcdMotionThreshold(1e-7);
    scene.character.body.setCcdSweptSphereRadius(0.25);
    if (isMainCharacter) {
      /**
       * Add 3rd Person Controls
       */
      scene.controls = new ThirdPersonControls(camera, scene.character, {
        offset: new THREE.Vector3(0, 1, 0),
        targetRadius: 3,
      });

      // set initial view to 90 deg theta
      scene.controls.theta = 180;

      /**
       * Add Pointer Lock and Pointer Drag
       */
      if (!isTouchDevice) {
        const pl = new PointerLock(canvas);
        const pd = new PointerDrag(canvas);
        pd.onMove((delta) => {
          if (pl.isLocked()) {
            scene.moveTop = -delta.y;
            scene.moveRight = delta.x;
          }
        });
      }

      stateStorage.set("controls", scene.controls);
      stateStorage.set("main_character", scene.character);
      setTimeout(() => {
        scene.isFalling = true;
        scene.manFalling = true;
      });

      for (const child of stateStorage.get("ambient_childs")) {
        physics.add.collider(scene.character, child, () => {
          stateStorage.set("last_fall", false);
          stateStorage.set("is_falling", false);
          stateStorage.set(
            "last_body_vector",
            child.geometry.boundingSphere.center
          );
          scene.isJumping = false;
        });
      }
    }
  }, [scene, asset, name, isMainCharacter, isTouchDevice]);

  useEffect(() => {
    // add setInterval to update the isFalling to false each 100ms
    const interval = setInterval(() => {
      const isFalling = stateStorage.get("is_falling");
      const lastFall = stateStorage.get("last_fall");

      if (scene == null) return;

      if (!isFalling && lastFall) {
        if (Date.now() - lastFall > 500) {
          stateStorage.set("is_falling", true);
        }
      } else {
        stateStorage.set("last_fall", Date.now());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [scene]);

  useEffect(() => {
    handleCharacter().catch((err) => console.log(err));
  }, [handleCharacter, create]);

  return null;
});

Character.displayName = "Character";

export default Character;
