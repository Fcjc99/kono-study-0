export type BuildCategory='paths'|'water'|'decor'|'seasonal'
export type BuildAsset={id:string;label:string;category:BuildCategory;src:string}

export const BUILD_CATEGORY_LABELS:Record<BuildCategory,string>={
 paths:'Paths & Roads',
 water:'Bridges & Water',
 decor:'Garden & Study Decor',
 seasonal:'Lighting, Seasonal & Wildlife',
}

const asset=(category:BuildCategory,id:string):BuildAsset=>({id,label:id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),category,src:'/garden/build/assets/'+category+'/'+id+'.png'})

export const BUILD_ASSETS:BuildAsset[]=[
 ...['dirt_path_corner','dirt_path_crossroad','dirt_path_diagonal','dirt_path_straight_horizontal','dirt_path_t_junction','grass_path_patch_small_1','grass_path_patch_small_2','grass_path_patch_small_3','grass_path_patch_small_4','grass_path_patch_small_5','stepping_stone_path','stone_hill_stairs'].map(id=>asset('paths',id)),
 ...['lily_pad_cluster','rope_bridge','rowboat','small_dock','stone_bridge','stone_fountain','stream_corner_segment','stream_waterfall_segment','waterfall_cliff_edge','wishing_well','wooden_bridge_curved','wooden_bridge_straight'].map(id=>asset('water',id)),
 ...['art_easel','book_stack','bulletin_board','cute_stone_statue','flower_bed','hammock','herb_garden_bed','mailbox','mushroom_patch','outdoor_study_desk','picnic_blanket','reading_bench','signpost','tea_table_cushions','vegetable_garden_bed','wind_chime'].map(id=>asset('decor',id)),
 ...['autumn_leaf_pile','butterflies','campfire','cherry_petal_pile','ducks','exam_project_shrine','firefly_jars','glowing_mushrooms','holiday_lights','koi_fish','lantern_post','paper_lantern_pair','pumpkin_cluster','scroll_board','sleeping_cat','small_bird','snow_patch','squirrel','star_plaque','string_light_arch','trophy_stand'].map(id=>asset('seasonal',id)),
]

export const BUILD_ASSET_BY_ID:Record<string,BuildAsset>=Object.fromEntries(BUILD_ASSETS.map(a=>[a.id,a]))
export const BUILD_CATEGORIES:BuildCategory[]=['paths','water','decor','seasonal']
