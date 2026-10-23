import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LineChart } from './LineChart'

describe('LineChart', () => {
  it('son değer etiketi ondalığı virgülle yazar (başlıktaki 117,2 ile aynı)', () => {
    const html = renderToStaticMarkup(
      <LineChart points={[{ label: '10 Ağu', value: 110 }, { label: '19 Eki', value: 117.2 }]} unit="kg" />,
    )
    expect(html).toContain('117,2 kg')
    expect(html).not.toContain('117.2')
  })

  it('tam sayıda ondalık yazmaz', () => {
    const html = renderToStaticMarkup(<LineChart points={[{ label: 'a', value: 80 }, { label: 'b', value: 81 }]} unit="kg" />)
    expect(html).toContain('81 kg')
  })
})
