type HeaderProps = { selectedDate: string; onAdd: () => void; profileName?: string; remaining?: number }
export default function Header({ selectedDate, onAdd, profileName='Sophia', remaining=0 }: HeaderProps) {
  const date = new Date(`${selectedDate}T12:00:00`)
  const formatted = new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(date)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return <header className="topbar"><div><p className="eyebrow">{formatted}</p><h2>{greeting}, {profileName}</h2><p className="header-subtitle">{remaining?`${remaining} task${remaining===1?'':'s'} left today.`:'Your planned work is complete.'}</p></div><button className="add-button" onClick={onAdd}>+ Add assignment</button></header>
}
