import { formatFecha, formatMoneda } from '../../lib/formatters'

export default function TarjetaCuotasDoc({ credito, cliente, cuotas, config }) {
  const negocio = config?.negocio || {}

  // Agrupar cuotas en grupos de 3 para el layout de 3 columnas
  const filas = []
  for (let i = 0; i < cuotas.length; i += 3) {
    filas.push(cuotas.slice(i, i + 3))
  }

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      width: '148mm',
      padding: '5mm',
      border: '1px solid #000',
      pageBreakAfter: 'always'
    }}>
      {/* Encabezado */}
      <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>
          {negocio.nombre || 'POWERFUL'}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
          {negocio.subtitulo || 'PRÉSTAMOS'}
        </div>
        <div style={{ fontSize: '9px', color: '#555' }}>
          {negocio.direccion} · {negocio.localidad}, {negocio.provincia}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '1mm 0', marginBottom: '2mm', display: 'flex', justifyContent: 'space-between' }}>
        <span>COBRADOR: {credito.cobrador || '_______________'}</span>
        <span>VENDEDOR: {credito.vendedor || '_______________'}</span>
      </div>

      {/* Datos del cliente */}
      <table style={{ width: '100%', marginBottom: '3mm', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '20%', fontWeight: 'bold' }}>CLIENTE:</td>
            <td style={{ width: '80%' }}>
              {cliente.apellido}, {cliente.nombre} ({cliente.codigo})
            </td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>DIRECCIÓN:</td>
            <td>{cliente.domicilio}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>LOCALIDAD:</td>
            <td>{cliente.localidad}, {cliente.provincia}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>CEL:</td>
            <td>{cliente.celular}{cliente.celular_alternativo ? ` / ${cliente.celular_alternativo}` : ''}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>DNI:</td>
            <td>{cliente.dni}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>TIPO:</td>
            <td>{credito.tipo === 'hogar' ? 'Crédito del Hogar' : 'Préstamo en Efectivo'}</td>
          </tr>
          {credito.observaciones && (
            <tr>
              <td style={{ fontWeight: 'bold' }}>ARTÍCULO:</td>
              <td style={{ fontWeight: 'bold' }}>{credito.observaciones}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Resumen financiero */}
      <div style={{
        border: '1px solid #000',
        padding: '2mm',
        marginBottom: '3mm',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>FINANCIACIÓN</span>
          <span style={{ marginLeft: '5mm' }}>
            SALDO DEUDOR: <strong>{formatMoneda(credito.total_con_intereses)}</strong>
          </span>
        </div>
        <div>
          <span>Inicio: {formatFecha(credito.fecha_inicio)}</span>
        </div>
      </div>

      {/* Detalle del producto */}
      <table style={{ width: '100%', marginBottom: '3mm', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000' }}>
            <th style={{ textAlign: 'left', padding: '1mm' }}>ARTÍCULO</th>
            <th style={{ textAlign: 'right', padding: '1mm' }}>CUOTA</th>
            <th style={{ textAlign: 'center', padding: '1mm' }}>CUOTAS</th>
            <th style={{ textAlign: 'left', padding: '1mm' }}>1° VENC.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '1mm' }}>
              {credito.observaciones || (credito.tipo === 'hogar' ? 'Crédito del Hogar' : 'Préstamo en Efectivo')}
            </td>
            <td style={{ padding: '1mm', textAlign: 'right' }}><strong>{formatMoneda(credito.importe_cuota)}</strong></td>
            <td style={{ padding: '1mm', textAlign: 'center' }}>{credito.cantidad_cuotas} {credito.periodicidad === 'mensual' ? 'Men.' : credito.periodicidad === 'quincenal' ? 'Quin.' : 'Sem.'}</td>
            <td style={{ padding: '1mm' }}>{formatFecha(credito.fecha_primer_vencimiento)}</td>
          </tr>
        </tbody>
      </table>

      {/* Grilla de cuotas */}
      <div style={{ marginBottom: '3mm' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '9px', textAlign: 'center' }}>
          PLAN DE CUOTAS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center', width: '5%' }}>N°</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center' }}>VENCIMIENTO</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center', width: '20%' }}>COBRADO</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center', width: '5%' }}>N°</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center' }}>VENCIMIENTO</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center', width: '20%' }}>COBRADO</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center', width: '5%' }}>N°</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center' }}>VENCIMIENTO</th>
              <th style={{ border: '1px solid #000', padding: '1mm', textAlign: 'center', width: '20%' }}>COBRADO</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                {[0, 1, 2].map(j => (
                  fila[j] ? (
                    <>
                      <td key={`n${j}`} style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'center', fontWeight: 'bold' }}>
                        {fila[j].numero_cuota}
                      </td>
                      <td key={`f${j}`} style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'center' }}>
                        {formatFecha(fila[j].fecha_vencimiento)}
                      </td>
                      <td key={`c${j}`} style={{ border: '1px solid #000', padding: '1.5mm', height: '7mm' }}></td>
                    </>
                  ) : (
                    <>
                      <td key={`en${j}`} style={{ border: '1px solid #000' }}></td>
                      <td key={`ef${j}`} style={{ border: '1px solid #000' }}></td>
                      <td key={`ec${j}`} style={{ border: '1px solid #000' }}></td>
                    </>
                  )
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Observaciones */}
      <div style={{ fontSize: '8px', borderTop: '1px solid #ccc', paddingTop: '2mm' }}>
        <p style={{ marginBottom: '1mm' }}>
          <strong>1)</strong> El cobrador no tiene horario de cobranza y debe escribir en su tarjeta el importe cobrado, de lo contrario la empresa no se responsabilizará de dicho pago faltante.
        </p>
        <p>
          <strong>2)</strong> Los días feriados se cobra como un día hábil, de no haber abonado dicho importe al día siguiente.
        </p>
      </div>

      {/* Pie */}
      <div style={{ textAlign: 'right', fontSize: '8px', color: '#666', marginTop: '2mm' }}>
        {credito.numero_credito} · Página 1 de 1
      </div>
    </div>
  )
}
