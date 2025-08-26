import { DEPS_REGISTER } from '@/infrastructure/ioc/types'
import { mount, flushPromises } from '@vue/test-utils'
import { Container } from 'inversify'
import { Suspense, h, defineComponent } from 'vue'

const ioc = new Container()

export const registerDeps = (deps: Record<symbol, InstanceType<any>>) =>
  ioc.bind(DEPS_REGISTER).toConstantValue(deps)

export const mountSuspense = async (
  component: ReturnType<typeof defineComponent>,
  options: any
) => {
  const opts = {
    ...options,
    global: {
      provide: { _ioc: ioc }
    }
  }
  const suspense = defineComponent({
    components: {
      component
    },
    render() {
      return h(Suspense, null, {
        default: h(component, options.props),
        fallback: h('div', 'fallback')
      })
    }
  })
  const wrapper = mount(suspense, opts)
  await flushPromises()
  const childWrapper = wrapper.findComponent(component)
  return childWrapper ?? wrapper
}
