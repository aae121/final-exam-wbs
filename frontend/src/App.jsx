import React, { useEffect, useState } from 'react'

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString()
  } catch { return iso }
}

export default function App() {
  const [courses, setCourses] = useState([])
  const [form, setForm] = useState({ name: '', email: '', studentId: '', course: '', year: '1', agree: false })
  const [msg, setMsg] = useState('')
  const [registrations, setRegistrations] = useState([])
  const [filter, setFilter] = useState('')

  const apiBase = import.meta.env.VITE_API_BASE || (window.location.port === '5173' ? 'http://localhost:4000' : '')

  useEffect(() => {
    fetch(`${apiBase}/api/courses`).then(r => r.json()).then(setCourses).catch(() => setCourses([]))
    fetch(`${apiBase}/api/registrations`).then(r => r.json()).then(setRegistrations).catch(() => setRegistrations([]))
  }, [])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg('Submitting...')
    try {
      if(!userToken && !adminToken){ setShowUserAuth(true); setMsg('Please sign in to register'); return }
      const headers = { 'Content-Type': 'application/json' }
      const token = userToken || adminToken
      if(token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${apiBase}/api/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) {
        setMsg('Registration successful!')
        setForm({ name: '', email: '', studentId: '', course: '', year: '1', agree: false })
        // refresh registrations
        const regs = await fetch(`${apiBase}/api/registrations`).then(r => r.json())
        setRegistrations(regs.reverse())
      } else {
        setMsg(data.error || 'Submission failed')
      }
    } catch (err) {
      setMsg('Submission failed')
    }
    setTimeout(() => setMsg(''), 3000)
  }

  const visibleRegs = registrations.filter(r => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (r.name && r.name.toLowerCase().includes(q)) || (r.email && r.email.toLowerCase().includes(q)) || (r.studentId && r.studentId.toLowerCase().includes(q)) || (r.course && r.course.toLowerCase().includes(q))
  })

  const myCourses = [...new Set(registrations.map(r => r.course))].filter(Boolean)

  // UI helpers
  function toCSV(items) {
    const header = ['id','name','email','studentId','course','year','agree','createdAt']
    const rows = items.map(i => header.map(h => JSON.stringify(i[h] ?? '')).join(','))
    return [header.join(','), ...rows].join('\n')
  }

  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '')
  const [adminUser, setAdminUser] = useState(localStorage.getItem('adminUser') || '')
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminCreds, setAdminCreds] = useState({username:'',password:''})
  const [adminCourses, setAdminCourses] = useState([])
  const [userToken, setUserToken] = useState(localStorage.getItem('userToken') || '')
  const [userInfo, setUserInfo] = useState(JSON.parse(localStorage.getItem('userInfo') || 'null'))
  const [showUserAuth, setShowUserAuth] = useState(false)
  const [userCreds, setUserCreds] = useState({username:'',password:''})
  const [registerCreds, setRegisterCreds] = useState({username:'',password:'',name:'',email:'',studentId:''})

  function showToast(text){ setToast(text); setTimeout(()=>setToast(null),2800) }

  async function handleDelete(id){
    if(!adminToken){ setPendingDelete(id); setShowAdminLogin(true); return }
    setConfirm({id})
  }

  async function confirmDelete(){
    if(!confirm) return
    try{
      const headers = {}
      if(adminToken) headers['Authorization'] = `Bearer ${adminToken}`
      const res = await fetch(`${apiBase}/api/registrations/${confirm.id}`,{method:'DELETE', headers})
      const data = await res.json()
      if(data.success){
        setRegistrations(prev => prev.filter(p => p.id !== confirm.id))
        showToast('Registration deleted')
      } else showToast('Delete failed')
    }catch(e){ showToast('Delete failed') }
    setConfirm(null)
  }

  function exportCSV(){
    const csv = toCSV(registrations)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'registrations.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function adminLogin(){
    try{
      const res = await fetch(`${apiBase}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(adminCreds)})
      const data = await res.json()
      if(data.token){
        setAdminToken(data.token)
        setAdminUser(adminCreds.username)
        localStorage.setItem('adminToken', data.token)
        localStorage.setItem('adminUser', adminCreds.username)
        setShowAdminLogin(false)
        showToast('Admin signed in')
        // refresh admin courses and regs
        const regs = await fetch(`${apiBase}/api/admin/registrations`,{headers:{'Authorization':`Bearer ${data.token}`}}).then(r=>r.json())
        setRegistrations(regs.reverse())
        const cs = await fetch(`${apiBase}/api/courses`).then(r=>r.json())
        setCourses(cs)
        if(pendingDelete){ setConfirm({id:pendingDelete}); setPendingDelete(null) }
      } else {
        showToast(data.error || 'Login failed')
      }
    }catch(e){ showToast('Login failed') }
  }

  function adminLogout(){
    setAdminToken(''); setAdminUser(''); localStorage.removeItem('adminToken'); localStorage.removeItem('adminUser'); showToast('Signed out')
  }

  async function addCourse(id,title){
    if(!adminToken) return showToast('Sign in as admin')
    try{
      const res = await fetch(`${apiBase}/api/admin/courses`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${adminToken}`},body:JSON.stringify({id,title})})
      const data = await res.json()
      if(data.success){
        const cs = await fetch(`${apiBase}/api/courses`).then(r=>r.json())
        setCourses(cs)
        showToast('Course added')
      } else showToast('Add failed')
    }catch(e){ showToast('Add failed') }
  }

  async function deleteCourse(id){
    if(!adminToken) return showToast('Sign in as admin')
    try{
      const res = await fetch(`${apiBase}/api/admin/courses/${id}`,{method:'DELETE',headers:{'Authorization':`Bearer ${adminToken}`}})
      const data = await res.json()
      if(data.success){
        const cs = await fetch(`${apiBase}/api/courses`).then(r=>r.json())
        setCourses(cs)
        showToast('Course removed')
      } else showToast('Remove failed')
    }catch(e){ showToast('Remove failed') }
  }

  // User auth: login/register/logout
  async function userLogin(){
    try{
      const res = await fetch(`${apiBase}/api/users/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(userCreds)})
      const data = await res.json()
      if(data.token){
        setUserToken(data.token)
        setUserInfo(data.user)
        localStorage.setItem('userToken', data.token)
        localStorage.setItem('userInfo', JSON.stringify(data.user))
        setShowUserAuth(false)
        showToast('Signed in')
        const regs = await fetch(`${apiBase}/api/registrations`,{headers:{'Authorization':`Bearer ${data.token}`}}).then(r=>r.json())
        setRegistrations(regs.reverse())
      } else showToast(data.error || 'Login failed')
    }catch(e){ showToast('Login failed') }
  }

  async function userRegister(){
    try{
      const res = await fetch(`${apiBase}/api/users/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(registerCreds)})
      const data = await res.json()
      if(data.success){
        showToast('Account created — please sign in')
        // pre-fill login
        setUserCreds({username: registerCreds.username, password: registerCreds.password})
      } else showToast(data.error || 'Create failed')
    }catch(e){ showToast('Create failed') }
  }

  function userLogout(){ setUserToken(''); setUserInfo(null); localStorage.removeItem('userToken'); localStorage.removeItem('userInfo'); showToast('Signed out') }

  return (
    <div className="container">
      <header>
        <div>
          <h1>Student Course Registration</h1>
          <p>Register for courses quickly — your registrations are listed on the right.</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {userInfo ? (
            <>
              <div style={{fontSize:13,color:'#6b7280'}}>Hello, {userInfo.name}</div>
              <button className="icon-btn" onClick={userLogout}>Sign out</button>
            </>
          ) : (
            <button className="icon-btn" onClick={()=>setShowUserAuth(true)}>Sign in</button>
          )}

          <div style={{width:1,background:'#eef2ff',height:28,marginLeft:6,marginRight:6}} />

          {adminUser ? (
            <>
              <div style={{fontSize:13,color:'#6b7280'}}>Admin: {adminUser}</div>
              <button className="icon-btn" onClick={adminLogout}>Sign out</button>
            </>
          ) : (
            <button className="icon-btn" onClick={()=>setShowAdminLogin(true)}>Admin</button>
          )}

          <div className="chip">{registrations.length} total registrations</div>
        </div>
      </header>

      <main className="layout">
        <div className="grid-two">
          <section className="panel">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Name<input name="name" value={form.name} onChange={handleChange} required /></label>
                <label>Email<input name="email" type="email" value={form.email} onChange={handleChange} required /></label>
              </div>

              <div className="form-row">
                <label>Student ID<input name="studentId" value={form.studentId} onChange={handleChange} /></label>
                <label>Course
                  <select name="course" value={form.course} onChange={handleChange} required>
                    <option value="">-- pick a course --</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.id} - {c.title}</option>)}
                  </select>
                </label>
              </div>

              <fieldset style={{marginTop:8}}>
                <legend style={{fontSize:13,marginBottom:6}}>Year</legend>
                <label><input type="radio" name="year" value="1" checked={form.year==='1'} onChange={handleChange} /> 1</label>
                <label style={{marginLeft:8}}><input type="radio" name="year" value="2" checked={form.year==='2'} onChange={handleChange} /> 2</label>
                <label style={{marginLeft:8}}><input type="radio" name="year" value="3" checked={form.year==='3'} onChange={handleChange} /> 3</label>
              </fieldset>

              <div style={{marginTop:12}} className="checkbox"><label><input type="checkbox" name="agree" checked={form.agree} onChange={handleChange} /> I agree to the terms</label></div>

              <div style={{display:'flex',alignItems:'center',gap:12,marginTop:12}}>
                <button type="submit" className="btn">Submit Registration</button>
                <div className="message">{msg}</div>
              </div>

              <div style={{marginTop:14}}>
                <div style={{fontSize:13,color:'#374151'}}>Your registered courses</div>
                <div className="courses-list">
                    {myCourses.length ? myCourses.map(c => <div key={c} className="chip">{c}</div>) : <div style={{color:'#9ca3af'}}>No registrations yet</div>}
                </div>
                  {adminUser && (
                    <div style={{marginTop:12}}>
                      <h4 style={{margin:'8px 0'}}>Manage Courses</h4>
                      <div style={{display:'flex',gap:8}}>
                        <input id="newCourseId" placeholder="ID e.g. CS200" />
                        <input id="newCourseTitle" placeholder="Course title" />
                        <button className="btn" onClick={()=>{
                          const id = document.getElementById('newCourseId').value.trim()
                          const title = document.getElementById('newCourseTitle').value.trim()
                          if(id && title) addCourse(id,title)
                        }}>Add</button>
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
                        {courses.map(c=> (
                          <div key={c.id} style={{display:'flex',alignItems:'center',gap:8}}>
                            <div className="chip">{c.id}</div>
                            <div style={{fontSize:13,color:'#374151'}}>{c.title}</div>
                            <button className="icon-btn" onClick={()=>deleteCourse(c.id)}>Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </form>
          </section>

          <aside className="panel">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{margin:0}}>Registrations</h3>
              <div style={{fontSize:13,color:'#6b7280'}}>{visibleRegs.length} shown</div>
            </div>

            <div className="search">
              <input placeholder="Search by name, email, student ID or course" value={filter} onChange={e => setFilter(e.target.value)} />
            </div>

            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <div style={{display:'flex',gap:8}}>
                <button className="icon-btn" onClick={()=>setRegistrations([]) || showToast('Cleared locally')} title="Clear list">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Clear
                </button>
                <button className="icon-btn" onClick={exportCSV} title="Export CSV">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 9l4 4 4-4" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Export
                </button>
              </div>
              <div style={{color:'#6b7280',fontSize:13}}>{visibleRegs.length} shown</div>
            </div>

            <div className="registrations">
              {visibleRegs.length === 0 && <div style={{color:'#9ca3af'}}>No registrations</div>}
              {visibleRegs.map(r => (
                <div key={r.id} className="reg-item">
                  <div>
                    <div style={{fontWeight:700,display:'flex',gap:8,alignItems:'center'}}>
                      <div style={{width:40,height:40,background:'linear-gradient(135deg,#eef2ff,#f0fcff)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#111827'}}>{(r.name||'')[0]||'U'}</div>
                      <div>{r.name} <span className="reg-course">{r.course}</span></div>
                    </div>
                    <div className="reg-meta">{r.email} • ID: {r.studentId || '—'} • Year {r.year} • {formatDate(r.createdAt)}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
                    <div className="chip">{r.agree ? 'Agreed' : '—'}</div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="icon-btn" onClick={()=>handleDelete(r.id)} title="Delete">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <footer style={{marginTop:18,textAlign:'center',color:'#9ca3af'}}>
        <small>Built for coursework. Deploy to Render or GitHub Pages + Render.</small>
      </footer>

      {toast && (
        <div className="toast-wrap"><div className="toast">{toast}</div></div>
      )}

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <h4>Delete registration?</h4>
            <p>Are you sure you want to permanently delete this registration?</p>
            <div className="actions">
              <button className="icon-btn" onClick={()=>setConfirm(null)}>Cancel</button>
              <button className="btn" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {showUserAuth && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <h4>Sign in / Create account</h4>
            <div style={{display:'grid',gap:8}}>
              <div style={{display:'flex',gap:8}}>
                <input placeholder="Username" value={userCreds.username} onChange={e=>setUserCreds(prev=>({...prev,username:e.target.value}))} />
                <input placeholder="Password" type="password" value={userCreds.password} onChange={e=>setUserCreds(prev=>({...prev,password:e.target.value}))} />
                <button className="btn" onClick={userLogin}>Sign in</button>
              </div>

              <div style={{height:1,background:'#eef2ff',margin:'6px 0'}} />

              <div style={{fontSize:13,color:'#374151'}}>Create account</div>
              <input placeholder="Username" value={registerCreds.username} onChange={e=>setRegisterCreds(prev=>({...prev,username:e.target.value}))} />
              <input placeholder="Password" type="password" value={registerCreds.password} onChange={e=>setRegisterCreds(prev=>({...prev,password:e.target.value}))} />
              <input placeholder="Full name" value={registerCreds.name} onChange={e=>setRegisterCreds(prev=>({...prev,name:e.target.value}))} />
              <input placeholder="Email" value={registerCreds.email} onChange={e=>setRegisterCreds(prev=>({...prev,email:e.target.value}))} />
              <input placeholder="Student ID" value={registerCreds.studentId} onChange={e=>setRegisterCreds(prev=>({...prev,studentId:e.target.value}))} />
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button className="icon-btn" onClick={()=>setShowUserAuth(false)}>Close</button>
                <button className="btn" onClick={userRegister}>Create account</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAdminLogin && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <h4>Admin sign in</h4>
            <div style={{display:'grid',gap:8}}>
              <input placeholder="Username" value={adminCreds.username} onChange={e=>setAdminCreds(prev=>({...prev,username:e.target.value}))} />
              <input placeholder="Password" type="password" value={adminCreds.password} onChange={e=>setAdminCreds(prev=>({...prev,password:e.target.value}))} />
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button className="icon-btn" onClick={()=>setShowAdminLogin(false)}>Cancel</button>
                <button className="btn" onClick={adminLogin}>Sign in</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
