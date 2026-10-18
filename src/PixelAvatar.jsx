export default function PixelAvatar({ avatar = {}, size = 160 }) {
  const {skin='#e9ad87',hair='#493124',hairStyle='short',outfit='#7c3aed',accessory='none',outfitId='tee'}=avatar;
  const P=({x,y,w,h,c,rx=0})=><rect x={x} y={y} width={w} height={h} fill={c} rx={rx}/>;
  const dark='#342439', blush='#dc827e';
  return <svg width={size} height={size} viewBox="0 0 32 36" shapeRendering="crispEdges" aria-label="Customizable pixel character" role="img" style={{borderRadius:20,background:'#f0eaff'}}>
    <P x={3} y={28} w={26} h={2} c="#ded1ef"/><P x={6} y={30} w={20} h={1} c="#e3d7ef"/>
    {/* hair behind face */}
    {hairStyle==='long'&&<><P x={7} y={6} w={18} h={19} c={hair}/><P x={6} y={12} w={4} h={15} c={hair}/><P x={22} y={12} w={4} h={15} c={hair}/></>}
    {hairStyle==='curly'&&<><P x={6} y={7} w={20} h={15} c={hair}/><P x={5} y={11} w={3} h={7} c={hair}/><P x={24} y={11} w={3} h={7} c={hair}/></>}
    {/* layered legs, trousers and sneakers */}
    <P x={10} y={28} w={6} h={5} c="#60749b"/><P x={17} y={28} w={6} h={5} c="#60749b"/>
    <P x={9} y={33} w={8} h={2} c="#fff5e8"/><P x={17} y={33} w={8} h={2} c="#fff5e8"/>
    <P x={9} y={34} w={8} h={1} c="#5c456e"/><P x={17} y={34} w={8} h={1} c="#5c456e"/>
    {/* legs and shoes */}
    <P x={11} y={27} w={4} h={3} c="#4d467a"/><P x={17} y={27} w={4} h={3} c="#4d467a"/><P x={10} y={30} w={6} h={2} c={dark}/><P x={17} y={30} w={6} h={2} c={dark}/>
    {/* arms and outfit silhouette */}
    <P x={6} y={22} w={5} h={5} c={outfit}/><P x={21} y={22} w={5} h={5} c={outfit}/><P x={7} y={26} w={3} h={3} c={skin}/><P x={22} y={26} w={3} h={3} c={skin}/>
    <P x={10} y={21} w={12} h={8} c={outfit}/><P x={12} y={19} w={8} h={4} c={skin}/>
    {outfitId==='shirt'&&<><path d="M12 21 L16 25 L20 21" fill="#fff"/><P x={15} y={24} w={2} h={5} c="#c6ddff"/></>}
    {outfitId==='crop'&&<><P x={10} y={26} w={12} h={3} c={skin}/><P x={10} y={28} w={12} h={2} c="#5d4d90"/></>}
    {outfitId==='hoodie'&&<><P x={12} y={21} w={8} h={2} c="#076a5b"/><P x={14} y={25} w={4} h={3} c="#0d806b"/><P x={14} y={22} w={1} h={4} c="#fff"/><P x={18} y={22} w={1} h={4} c="#fff"/></>}
    {outfitId==='jacket'&&<><P x={15} y={22} w={2} h={7} c="#fff2da"/><P x={11} y={23} w={2} h={2} c="#fdd76b"/><P x={19} y={23} w={2} h={2} c="#fdd76b"/></>}
    {outfitId==='cosmic'&&<><P x={12} y={24} w={2} h={2} c="#fff2aa"/><P x={19} y={26} w={2} h={2} c="#fef"/><P x={17} y={22} w={1} h={1} c="#ffe79b"/></>}
    {/* garment stitching, collar and small emblem */}
    <P x={12} y={22} w={3} h={1} c="#ffffff88"/><P x={17} y={22} w={3} h={1} c="#ffffff88"/>
    <P x={14} y={25} w={3} h={2} c="#ffffff66"/>
    {/* head with ears and shading */}
    <P x={7} y={12} w={3} h={5} c={skin}/><P x={22} y={12} w={3} h={5} c={skin}/><P x={9} y={8} w={14} h={13} c={skin}/><P x={11} y={20} w={10} h={2} c={skin}/><P x={21} y={11} w={2} h={8} c="#00000012"/>
    {/* hairstyle */}
    {hairStyle==='short'&&<><P x={8} y={5} w={16} h={5} c={hair}/><P x={7} y={8} w={4} h={6} c={hair}/><P x={21} y={8} w={4} h={5} c={hair}/><P x={11} y={9} w={5} h={2} c={hair}/></>}
    {hairStyle==='long'&&<><P x={8} y={5} w={16} h={6} c={hair}/><P x={8} y={9} w={4} h={9} c={hair}/><P x={22} y={9} w={3} h={12} c={hair}/><P x={11} y={10} w={6} h={2} c={hair}/></>}
    {hairStyle==='curly'&&<><P x={8} y={5} w={5} h={5} c={hair}/><P x={12} y={4} w={6} h={6} c={hair}/><P x={18} y={5} w={6} h={5} c={hair}/><P x={7} y={9} w={4} h={5} c={hair}/><P x={22} y={9} w={4} h={5} c={hair}/><P x={13} y={9} w={4} h={2} c={hair}/></>}
    {/* hairstyle accents and individual strands */}
    {hairStyle==='short'&&<><P x={11} y={5} w={5} h={2} c="#ffffff24"/><P x={18} y={7} w={3} h={1} c="#ffffff24"/></>}
    {hairStyle==='long'&&<><P x={8} y={14} w={2} h={8} c="#ffffff20"/><P x={23} y={15} w={1} h={8} c="#ffffff20"/></>}
    {hairStyle==='curly'&&<><P x={10} y={5} w={2} h={2} c="#ffffff28"/><P x={17} y={5} w={3} h={2} c="#ffffff28"/></>}
    {/* face with expressive eyes, brows, cheeks and smile */}
    <P x={11} y={13} w={4} h={1} c={hair}/><P x={18} y={13} w={4} h={1} c={hair}/>
    <P x={12} y={15} w={2} h={3} c={dark}/><P x={19} y={15} w={2} h={3} c={dark}/><P x={12} y={15} w={1} h={1} c="#fff"/><P x={19} y={15} w={1} h={1} c="#fff"/>
    <P x={10} y={18} w={3} h={1} c={blush}/><P x={21} y={18} w={2} h={1} c={blush}/><P x={15} y={19} w={4} h={1} c="#a75659"/><P x={16} y={20} w={2} h={1} c="#a75659"/>
    {(accessory==='glasses'||accessory==='rareGlasses')&&<><rect x="10" y="14" width="6" height="5" fill={accessory==='rareGlasses'?'#f8d76488':'#b6e5ff55'} stroke={accessory==='rareGlasses'?'#e0aa22':dark} strokeWidth="1"/><rect x="18" y="14" width="6" height="5" fill={accessory==='rareGlasses'?'#f8d76488':'#b6e5ff55'} stroke={accessory==='rareGlasses'?'#e0aa22':dark} strokeWidth="1"/><P x={16} y={15} w={2} h={1} c={dark}/></>}
    {accessory==='cap'&&<><P x={7} y={5} w={18} h={5} c="#7c3aed"/><P x={5} y={9} w={23} h={2} c="#5a2dbb"/><P x={14} y={6} w={4} h={2} c="#e8d4ff"/></>}
    {accessory==='crown'&&<><P x={9} y={4} w={14} h={4} c="#f5b52f"/><P x={9} y={1} w={3} h={4} c="#ffd95e"/><P x={15} y={2} w={3} h={4} c="#ffd95e"/><P x={21} y={1} w={3} h={4} c="#ffd95e"/><P x={15} y={5} w={3} h={2} c="#ec5e9b"/></>}
  </svg>;
}
