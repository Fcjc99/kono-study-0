/** The emoji avatars to pick from, for you (Settings › Plans & account) and each kid (Kids' appearance). */
export const AVATARS=['🦊','🐼','🐨','🐯','🦁','🐸','🐙','🦄','🐝','🦋','🐢','🐬','🌸','🌻','🍀','⭐','🌙','☀️','🌈','🔥','🎧','🎨','📚','⚽','🏀','🎹','🧁','🍓','🚀','👑']

/** A picture from the camera roll, cropped to the middle square and shrunk to 128 px, as a small
 * JPEG data URL (a few KB) so it saves with the plan and shows on every device. */
export async function avatarFromFile(file:File):Promise<string>{
 if(!file.type.startsWith('image/'))throw Error('That isn’t a picture. Choose a photo.')
 const bitmap=await createImageBitmap(file).catch(()=>{throw Error('Could not open that picture. Try a JPEG or PNG.')})
 try{
  const side=Math.min(bitmap.width,bitmap.height),size=128,canvas=document.createElement('canvas')
  canvas.width=size;canvas.height=size
  const g=canvas.getContext('2d');if(!g)throw Error('Could not make the picture.')
  g.fillStyle='#fff';g.fillRect(0,0,size,size) // a see-through PNG would turn black as a JPEG
  g.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,size,size)
  for(const quality of [0.82,0.7,0.55]){const url=canvas.toDataURL('image/jpeg',quality);if(url.length<=60000)return url}
  throw Error('That picture is too detailed. Try another.')
 }finally{bitmap.close()}
}
