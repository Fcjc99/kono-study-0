// A slimmer Phaser for the Sanctuary island: the production build points `import 'phaser'` here
// (vite.config.ts) instead of the full prebuilt bundle, so the engine download skips what the island
// never uses -- Arcade and Matter physics, sound, tilemaps, particles, video, DOM elements, bitmap
// text, the WebGL-only extras (shaders, noise, meshes, ...) and the rarer shapes and loader file types.
// Both renderers stay (the game asks for AUTO, so phones without WebGL still fall back to Canvas).
// It follows Phaser's own phaser-core.js entry, plus the pieces the island uses on top of it.
// Using a Phaser feature that isn't listed here? Add its module (and, for a Game Object, its
// Factory/Creator, which register `this.add.x` / `this.make.x`) below. Dev (`vite`) keeps the full build.
import '../../node_modules/phaser/src/polyfills/requestVideoFrame.js'
import CONST from '../../node_modules/phaser/src/const.js'
import Extend from '../../node_modules/phaser/src/utils/object/Extend.js'

import Animations from '../../node_modules/phaser/src/animations/index.js'
import BlendModes from '../../node_modules/phaser/src/renderer/BlendModes.js'
import Cache from '../../node_modules/phaser/src/cache/index.js'
import Cameras from '../../node_modules/phaser/src/cameras/index.js'
import Core from '../../node_modules/phaser/src/core/index.js'
import Class from '../../node_modules/phaser/src/utils/Class.js'
import Data from '../../node_modules/phaser/src/data/index.js'
import Display from '../../node_modules/phaser/src/display/index.js'
import DOM from '../../node_modules/phaser/src/dom/index.js'
import Events from '../../node_modules/phaser/src/events/index.js'
import Filters from '../../node_modules/phaser/src/filters/index.js'
import Game from '../../node_modules/phaser/src/core/Game.js'
import Geom from '../../node_modules/phaser/src/geom/index.js'
import Input from '../../node_modules/phaser/src/input/index.js'
import PhaserMath from '../../node_modules/phaser/src/math/index.js'
import Plugins from '../../node_modules/phaser/src/plugins/index.js'
import Renderer from '../../node_modules/phaser/src/renderer/index.js'
import Scale from '../../node_modules/phaser/src/scale/index.js'
import ScaleModes from '../../node_modules/phaser/src/renderer/ScaleModes.js'
import Scene from '../../node_modules/phaser/src/scene/Scene.js'
import Scenes from '../../node_modules/phaser/src/scene/index.js'
import Structs from '../../node_modules/phaser/src/structs/index.js'
import Textures from '../../node_modules/phaser/src/textures/index.js'
import Time from '../../node_modules/phaser/src/time/index.js'
import TintModes from '../../node_modules/phaser/src/renderer/TintModes.js'
import Tweens from '../../node_modules/phaser/src/tweens/index.js'
import Utils from '../../node_modules/phaser/src/utils/index.js'

import GameObjectEvents from '../../node_modules/phaser/src/gameobjects/events/index.js'
import DisplayList from '../../node_modules/phaser/src/gameobjects/DisplayList.js'
import GameObjectCreator from '../../node_modules/phaser/src/gameobjects/GameObjectCreator.js'
import GameObjectFactory from '../../node_modules/phaser/src/gameobjects/GameObjectFactory.js'
import UpdateList from '../../node_modules/phaser/src/gameobjects/UpdateList.js'
import Components from '../../node_modules/phaser/src/gameobjects/components/index.js'
import GetCalcMatrix from '../../node_modules/phaser/src/gameobjects/GetCalcMatrix.js'
import BuildGameObject from '../../node_modules/phaser/src/gameobjects/BuildGameObject.js'
import BuildGameObjectAnimation from '../../node_modules/phaser/src/gameobjects/BuildGameObjectAnimation.js'
import GameObject from '../../node_modules/phaser/src/gameobjects/GameObject.js'
import Container from '../../node_modules/phaser/src/gameobjects/container/Container.js'
import Graphics from '../../node_modules/phaser/src/gameobjects/graphics/Graphics.js'
import Image from '../../node_modules/phaser/src/gameobjects/image/Image.js'
import Layer from '../../node_modules/phaser/src/gameobjects/layer/Layer.js'
import Sprite from '../../node_modules/phaser/src/gameobjects/sprite/Sprite.js'
import Text from '../../node_modules/phaser/src/gameobjects/text/Text.js'
import Shape from '../../node_modules/phaser/src/gameobjects/shape/Shape.js'
import Arc from '../../node_modules/phaser/src/gameobjects/shape/arc/Arc.js'
import Ellipse from '../../node_modules/phaser/src/gameobjects/shape/ellipse/Ellipse.js'
import Rectangle from '../../node_modules/phaser/src/gameobjects/shape/rectangle/Rectangle.js'
// Each Factory / Creator registers its `this.add.x` / `this.make.x` when loaded (it exports nothing).
import '../../node_modules/phaser/src/gameobjects/container/ContainerFactory.js'
import '../../node_modules/phaser/src/gameobjects/graphics/GraphicsFactory.js'
import '../../node_modules/phaser/src/gameobjects/image/ImageFactory.js'
import '../../node_modules/phaser/src/gameobjects/layer/LayerFactory.js'
import '../../node_modules/phaser/src/gameobjects/sprite/SpriteFactory.js'
import '../../node_modules/phaser/src/gameobjects/text/TextFactory.js'
import '../../node_modules/phaser/src/gameobjects/shape/arc/ArcFactory.js'
import '../../node_modules/phaser/src/gameobjects/shape/ellipse/EllipseFactory.js'
import '../../node_modules/phaser/src/gameobjects/shape/rectangle/RectangleFactory.js'
import '../../node_modules/phaser/src/gameobjects/container/ContainerCreator.js'
import '../../node_modules/phaser/src/gameobjects/graphics/GraphicsCreator.js'
import '../../node_modules/phaser/src/gameobjects/image/ImageCreator.js'
import '../../node_modules/phaser/src/gameobjects/layer/LayerCreator.js'
import '../../node_modules/phaser/src/gameobjects/sprite/SpriteCreator.js'
import '../../node_modules/phaser/src/gameobjects/text/TextCreator.js'

import File from '../../node_modules/phaser/src/loader/File.js'
import FileTypesManager from '../../node_modules/phaser/src/loader/FileTypesManager.js'
import GetURL from '../../node_modules/phaser/src/loader/GetURL.js'
import LoaderEvents from '../../node_modules/phaser/src/loader/events/index.js'
import LoaderPlugin from '../../node_modules/phaser/src/loader/LoaderPlugin.js'
import MergeXHRSettings from '../../node_modules/phaser/src/loader/MergeXHRSettings.js'
import MultiFile from '../../node_modules/phaser/src/loader/MultiFile.js'
import XHRLoader from '../../node_modules/phaser/src/loader/XHRLoader.js'
import XHRSettings from '../../node_modules/phaser/src/loader/XHRSettings.js'
import AnimationJSONFile from '../../node_modules/phaser/src/loader/filetypes/AnimationJSONFile.js'
import AtlasJSONFile from '../../node_modules/phaser/src/loader/filetypes/AtlasJSONFile.js'
import ImageFile from '../../node_modules/phaser/src/loader/filetypes/ImageFile.js'
import JSONFile from '../../node_modules/phaser/src/loader/filetypes/JSONFile.js'
import MultiAtlasFile from '../../node_modules/phaser/src/loader/filetypes/MultiAtlasFile.js'
import SpriteSheetFile from '../../node_modules/phaser/src/loader/filetypes/SpriteSheetFile.js'
import TextFile from '../../node_modules/phaser/src/loader/filetypes/TextFile.js'

const GameObjects = {
  Events: GameObjectEvents, DisplayList, GameObjectCreator, GameObjectFactory, UpdateList, Components, GetCalcMatrix,
  BuildGameObject, BuildGameObjectAnimation, GameObject, Container, Graphics, Image, Layer, Sprite, Text,
  Shape, Arc, Ellipse, Rectangle,
}

const Loader = {
  Events: LoaderEvents,
  FileTypes: { AnimationJSONFile, AtlasJSONFile, ImageFile, JSONFile, MultiAtlasFile, SpriteSheetFile, TextFile },
  File, FileTypesManager, GetURL, LoaderPlugin, MergeXHRSettings, MultiFile, XHRLoader, XHRSettings,
}

const Phaser = Extend(false, {
  Animations, BlendModes, Cache, Cameras, Core, Class, Data, Display, DOM, Events, Filters, Game,
  GameObjects, Geom, Input, Loader, Math: PhaserMath, Plugins, Renderer, Scale, ScaleModes, Scene, Scenes, Structs,
  Textures, Time, TintModes, Tweens, Utils,
}, CONST)

export default Phaser
