import { useId, useState, type FormEvent } from 'react'
import { ProductImageField } from '../components/ProductImageField'
import { useMarket } from '../store'

export function SellerInfoView() {
  const { state, saveSeller } = useMarket()
  const seller = state.seller
  const formId = useId()
  const [name, setName] = useState(seller?.name ?? '')
  const [businessName, setBusinessName] = useState(seller?.businessName ?? '')
  const [address, setAddress] = useState(seller?.address ?? '')
  const [gst, setGst] = useState(seller?.gst ?? '')
  const [profileImage, setProfileImage] = useState(seller?.profileImage ?? '')
  const [logo, setLogo] = useState(seller?.logo ?? '')
  const [facebook, setFacebook] = useState(seller?.facebook ?? '')
  const [instagram, setInstagram] = useState(seller?.instagram ?? '')
  const [youtube, setYoutube] = useState(seller?.youtube ?? '')
  const [whatsapp, setWhatsapp] = useState(seller?.whatsapp ?? '')
  const [error, setError] = useState<string | null>(null)
  const [sellerPassword, setSellerPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = saveSeller({
      name,
      businessName,
      address,
      gst,
      profileImage,
      logo,
      facebook,
      instagram,
      youtube,
      whatsapp,
    })
    setError(result.ok ? null : result.error)
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Seller info</h2>
          <p className="lede">Save the shop profile here, then edit it whenever the details change.</p>
        </div>
      </div>
      <form className="profile-form" onSubmit={submit}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <section className="form-group">
          <h3 className="section-label">Business</h3>
          <div className="fields">
            <label className="field" htmlFor={`${formId}-business`}>
              <span>Business name</span>
              <input
                id={`${formId}-business`}
                value={businessName}
                autoComplete="organization"
                onChange={(event) => setBusinessName(event.target.value)}
              />
            </label>
            <label className="field" htmlFor={`${formId}-name`}>
              <span>Seller name</span>
              <input
                id={`${formId}-name`}
                value={name}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          </div>
          <label className="field" htmlFor={`${formId}-address`}>
            <span>Address</span>
            <textarea
              id={`${formId}-address`}
              value={address}
              rows={3}
              autoComplete="street-address"
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <label className="field" htmlFor={`${formId}-gst`}>
            <span>GST number</span>
            <input
              id={`${formId}-gst`}
              value={gst}
              autoComplete="off"
              placeholder="22AAAAA0000A1Z5"
              onChange={(event) => setGst(event.target.value)}
            />
          </label>
        </section>
        <section className="form-group">
          <h3 className="section-label">🔒 Seller access</h3>
          <p className="hint">Set or reset the password used when opening Seller. This password is stored on this device.</p>
          <label className="field" htmlFor={`${formId}-password`}><span>New seller password</span><input id={`${formId}-password`} type="password" autoComplete="new-password" value={sellerPassword} onChange={event=>setSellerPassword(event.target.value)} /></label>
          <div className="dialog-actions"><button type="button" className="btn secondary" onClick={()=>{localStorage.removeItem('market.seller.password');localStorage.removeItem('market.seller.unlocked');setSellerPassword('');setPasswordMessage('Seller password removed. Seller access will open without a password until you set one.') }}>Remove password</button><button type="button" className="btn" onClick={()=>{if(!sellerPassword.trim()){setPasswordMessage('Enter a password first.');return}localStorage.setItem('market.seller.password',sellerPassword);localStorage.setItem('market.seller.unlocked','true');setSellerPassword('');setPasswordMessage('Seller password saved on this device.') }}>Save password</button></div>
          {passwordMessage && <p role="status" className="hint">{passwordMessage}</p>}
        </section>
        <section className="form-group">
          <h3 className="section-label">Photos</h3>
          <div className="fields">
            <ProductImageField image={profileImage} label="Profile image" testId="seller-profile" onChange={setProfileImage} />
            <ProductImageField image={logo} label="Business logo" testId="seller-logo" onChange={setLogo} />
          </div>
        </section>
        <section className="form-group">
          <h3 className="section-label">Social</h3>
          <div className="fields">
            <label className="field" htmlFor={`${formId}-facebook`}>
              <span>Facebook</span>
              <input
                id={`${formId}-facebook`}
                value={facebook}
                autoComplete="off"
                placeholder="facebook.com/shop"
                onChange={(event) => setFacebook(event.target.value)}
              />
            </label>
            <label className="field" htmlFor={`${formId}-instagram`}>
              <span>Instagram</span>
              <input
                id={`${formId}-instagram`}
                value={instagram}
                autoComplete="off"
                placeholder="@shop"
                onChange={(event) => setInstagram(event.target.value)}
              />
            </label>
            <label className="field" htmlFor={`${formId}-youtube`}>
              <span>YouTube</span>
              <input
                id={`${formId}-youtube`}
                value={youtube}
                autoComplete="off"
                placeholder="youtube.com/@shop"
                onChange={(event) => setYoutube(event.target.value)}
              />
            </label>
            <label className="field" htmlFor={`${formId}-whatsapp`}>
              <span>WhatsApp ID</span>
              <input
                id={`${formId}-whatsapp`}
                value={whatsapp}
                autoComplete="off"
                placeholder="919876543210"
                onChange={(event) => setWhatsapp(event.target.value)}
              />
            </label>
          </div>
        </section>
        <div className="dialog-actions">
          <button type="submit" className="btn">
            Save seller info
          </button>
        </div>
      </form>
    </section>
  )
}
