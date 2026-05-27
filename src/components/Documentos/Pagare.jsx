import { nombreMes, numeroALetras, hoyArgentina } from '../../lib/formatters'

export default function PagareDoc({ credito, cliente, config }) {
  const pagConf = config?.pagare || {}
  const hoy = hoyArgentina()
  const totalLetras = numeroALetras(credito.total_con_intereses)

  const fechaVenc = credito.fecha_primer_vencimiento
  const diaVenc = new Date(fechaVenc + 'T12:00:00').getDate()
  const mesVenc = nombreMes(fechaVenc)
  const anioVenc = new Date(fechaVenc + 'T12:00:00').getFullYear()

  const diaHoy = new Date(hoy + 'T12:00:00').getDate()
  const mesHoy = nombreMes(hoy)
  const anioHoy = new Date(hoy + 'T12:00:00').getFullYear()

  const totalStr = credito.total_con_intereses.toLocaleString('es-AR', { minimumFractionDigits: 2 })

  const line = (width = '100%') => (
    <div style={{ borderBottom: '1px solid #000', width, display: 'inline-block', minHeight: '3mm' }} />
  )

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      width: '190mm',
      minHeight: '270mm',
      padding: '10mm 15mm',
      boxSizing: 'border-box',
      pageBreakAfter: 'always',
      lineHeight: '1.8',
      position: 'relative'
    }}>
      {/* Fila superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm' }}>
        {/* Sellado */}
        <div style={{ width: '35%' }}>
          <span style={{ fontSize: '10px' }}>Sellado:</span>
          <div style={{ borderBottom: '1px solid #000', marginTop: '5mm', width: '80%' }} />
        </div>

        {/* Vence / Por */}
        <div style={{ width: '55%', textAlign: 'right' }}>
          <div style={{ marginBottom: '2mm' }}>
            Vence el{' '}
            <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '8mm' }}>{diaVenc}</span>
            {' '}de{' '}
            <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '18mm' }}>{mesVenc}</span>
            {' '}de{' '}
            <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '14mm' }}>{anioVenc}</span>
          </div>
          <div>
            Por ($<span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '35mm', fontWeight: 'bold' }}>{totalStr}</span>)
          </div>
        </div>
      </div>

      {/* Lugar y fecha */}
      <div style={{ marginBottom: '8mm' }}>
        <strong>{pagConf.localidad || 'Almafuerte'}</strong>:{' '}
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '6mm' }}>{diaHoy}</span>
        {' '}de{' '}
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '18mm' }}>{mesHoy}</span>
        {' '}de{' '}
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '14mm' }}>{anioHoy}</span>
      </div>

      {/* Cuerpo principal */}
      <div style={{ marginBottom: '10mm', textAlign: 'justify', lineHeight: '2.2' }}>
        El día{' '}
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '6mm' }}>{diaVenc}</span>
        {' '}de{' '}
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '18mm' }}>{mesVenc}</span>
        {' '}de{' '}
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '14mm' }}>{anioVenc}</span>
        {' '}Pagaré <em>"Sin Protesto"</em> (art. 50 D. Ley 5965/63) a{' '}
        <strong>{pagConf.acreedor || 'Secchiari Caroline'}</strong>{' '}
        CUT <strong>{pagConf.cuit || '27-17111940-0'}</strong>{' '}
        o a su orden la cantidad de pesos{' '}
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '80mm', fontWeight: 'bold' }}>
          {totalLetras}
        </span>
        {' '}=$ <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '30mm', fontWeight: 'bold' }}>
          {totalStr}
        </span>)
      </div>

      <div style={{ marginBottom: '12mm', textAlign: 'justify' }}>
        por igual valor recibido en efectivo a mi entera satisfacción. Pagadero en calle{' '}
        <strong>{pagConf.direccion || 'Pedro C. Molina N° 318'}</strong>, de la localidad de{' '}
        <strong>{pagConf.ciudad || 'Almafuerte'}</strong>.
      </div>

      {/* Campos con líneas */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12mm' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', paddingRight: '8mm', paddingBottom: '5mm' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '1mm', minHeight: '6mm' }}>
                {cliente.domicilio}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '1mm' }}>Domicilio:</div>
            </td>
            <td style={{ width: '50%', paddingBottom: '5mm' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '1mm', minHeight: '6mm' }}></div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '1mm' }}>Firma:</div>
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: '8mm', paddingBottom: '5mm' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '1mm', minHeight: '6mm' }}>
                {cliente.localidad}, {cliente.provincia}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '1mm' }}>Localidad:</div>
            </td>
            <td style={{ paddingBottom: '5mm' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '1mm', minHeight: '6mm' }}>
                {cliente.apellido}, {cliente.nombre}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '1mm' }}>Aclaración:</div>
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: '8mm' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '1mm', minHeight: '6mm' }}>
                {cliente.celular}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '1mm' }}>Teléfono:</div>
            </td>
            <td>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '1mm', minHeight: '6mm' }}>
                {cliente.dni}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '1mm' }}>D.N.I.:</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Cláusulas legales */}
      <div style={{ borderTop: '1px solid #ccc', paddingTop: '3mm', fontSize: '8px', color: '#333', lineHeight: '1.6' }}>
        <p style={{ marginBottom: '1mm' }}>
          Información necesaria cumplimentando el art. 36 ley 24.240 "DEFENSA AL CONSUMIDOR"
        </p>
        <p style={{ marginBottom: '1mm' }}>
          El presente devengará una tasa de interés efectiva anual del{' '}
          <strong>{credito.tasa_efectiva_anual?.toFixed(2) || '0.00'}% T.E.A.</strong>
        </p>
        <p style={{ marginBottom: '1mm' }}>
          Determinando su costo financiero total C.F.T. de{' '}
          <strong>{credito.costo_financiero_total?.toFixed(2) || '0.00'}%</strong>{' '}
          incluidos en el monto del documento pagaré. Se advierte que el presente no tiene gastos y/o cargos adicionales.
        </p>
        <p>
          El sistema de amortización de interés es el directo de tasa cargada.
        </p>
      </div>

      <div style={{ textAlign: 'right', fontSize: '8px', color: '#999', marginTop: '3mm' }}>
        {credito.numero_credito}
      </div>
    </div>
  )
}
