import { formatMoneda, formatFecha, hoyArgentina } from '../../lib/formatters'

function ReciboCopia({ pago, cuota, credito, cliente, config, copia }) {
  const negocio = config?.negocio || {}
  const metodos = { efectivo: 'Efectivo', transferencia: 'Transferencia bancaria', tarjeta: 'Tarjeta' }

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      border: '1px solid #000',
      padding: '5mm',
      width: '90mm',
      lineHeight: '1.5'
    }}>
      {/* Encabezado */}
      <div style={{ textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '2mm', marginBottom: '2mm' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{negocio.nombre || 'POWERFUL'}</div>
        <div style={{ fontSize: '9px' }}>{negocio.subtitulo || 'PRÉSTAMOS'}</div>
        <div style={{ fontSize: '8px', color: '#555' }}>{negocio.direccion} · {negocio.localidad}</div>
        <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2mm', letterSpacing: '1px' }}>
          RECIBO DE PAGO
        </div>
        <div style={{ fontSize: '8px', color: '#666', fontStyle: 'italic' }}>{copia}</div>
      </div>

      {/* Datos */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 'bold', width: '35%', paddingBottom: '1mm' }}>Fecha:</td>
            <td>{formatFecha(pago.fecha_pago)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>Cliente:</td>
            <td>{cliente.apellido}, {cliente.nombre}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>DNI:</td>
            <td>{cliente.dni}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>Crédito:</td>
            <td>{credito.numero_credito}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>Cuota N°:</td>
            <td>{cuota.numero_cuota} de {credito.cantidad_cuotas}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>Vencimiento:</td>
            <td>{formatFecha(cuota.fecha_vencimiento)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>Forma de pago:</td>
            <td>{metodos[pago.metodo_pago] || pago.metodo_pago}</td>
          </tr>
        </tbody>
      </table>

      {/* Desglose */}
      <div style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', margin: '2mm 0', padding: '2mm 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
          <span>Cuota:</span>
          <span>{formatMoneda(pago.importe_cuota)}</span>
        </div>
        {pago.interes_mora > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
            <span>Interés mora ({pago.dias_atraso} días):</span>
            <span>{formatMoneda(pago.interes_mora)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
          <span>TOTAL COBRADO:</span>
          <span>{formatMoneda(pago.total_cobrado)}</span>
        </div>
      </div>

      {/* Cobrador */}
      {pago.cobrador && (
        <div style={{ fontSize: '8px', color: '#555', marginBottom: '2mm' }}>
          Cobrador: {pago.cobrador}
        </div>
      )}

      {/* Firma */}
      <div style={{ marginTop: '4mm', paddingTop: '4mm', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '1mm', fontSize: '8px' }}>Firma cobrador</div>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '1mm', fontSize: '8px' }}>Aclaración</div>
        </div>
      </div>
    </div>
  )
}

export default function Recibo({ pago, cuota, credito, cliente, config }) {
  return (
    <div style={{ display: 'flex', gap: '5mm', flexWrap: 'wrap' }}>
      <ReciboCopia pago={pago} cuota={cuota} credito={credito} cliente={cliente} config={config} copia="Original - Cliente" />
      <ReciboCopia pago={pago} cuota={cuota} credito={credito} cliente={cliente} config={config} copia="Duplicado - Empresa" />
    </div>
  )
}
