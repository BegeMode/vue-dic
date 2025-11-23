<template>
  <div class="dialog-container" v-for="dlg in dialogs" :key="dlg.id">
    <dialog :open="dlg.show" class="dialog" :class="dlgClass(dlg)" :width="dlgWidth(dlg)" @close="handleCancel(dlg)"
      @keydown.esc="handleCancel(dlg)">
      <div class="dialog-content">
        <div class="dialog-header">
          <h2>{{ dlg.title }}</h2>
          <!-- <button @click="handleCancel(dlg)">X</button> -->
          <i class="material-icons" style="cursor: pointer" v-if="dlg.closable" size="20" @click="handleCancel(dlg)">
            close
          </i>
        </div>
        <div class="dialog-body">
          <Suspense v-if="(dlg as DialogWithComponent).component">
            <component :is="(dlg as DialogWithComponent).component" v-bind="(dlg as DialogWithComponent).props"
              v-model="dlg.result" @close="handleCancel(dlg, $event)" />
            <template #fallback>
              <span>Loading...</span>
              <!-- <loader :options="{ transparent: true, global: false }" indicator="circle" visible /> -->
            </template>
          </Suspense>
          <template v-else>
            <div v-html="(dlg as DialogWithText).text" />
            <div v-if="(dlg as DialogWithText).checkboxText" class="dialog-checkbox">
              <input type="checkbox" id="check" class="dialog-checkbox__input" v-model="dlg.result" />
              <label for="check">{{ (dlg as DialogWithText).checkboxText }}</label>
            </div>
          </template>
        </div>
        <div class="dialog-footer">
          <button v-if="!dlg.okOnly" class="dialog-btn" @click="handleCancel(dlg)">{{ dlg.cancelTitle }}</button>
          <button @click="handleOk(dlg)">{{ dlg.okTitle }}</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import type { PubSubService } from '@/infrastructure/services/pubSub.service'
import { DIALOG_CLOSE_ALL, DIALOG_OPEN_EVENT, type DialogWindow } from '@/ui/components/dialogContainer/types'
import { defineDeps } from '@/ui/defineComponent'
import { DEPS } from '@/ui/depIds'
import { DialogButton, type DialogWithComponent, type DialogWithText } from '@/ui/interactiveQuery/types'
import { nextTick, reactive, markRaw, onMounted, onBeforeUnmount } from 'vue'

type TDeps = {
  pubSubService: PubSubService
}
const { pubSubService } = defineDeps<TDeps>({ pubSubService: DEPS.PubSub })

let counter = 1
const uniqKey = (dlg: DialogWindow): string => `dlg-${dlg.id}`
const dialogs: Array<DialogWindow> = reactive([])

onMounted(() => {
  nextTick(() => {
    pubSubService.subscribe(DIALOG_OPEN_EVENT, open)
  })
  pubSubService.subscribe(DIALOG_CLOSE_ALL, closeAll)
})

onBeforeUnmount(() => {
  pubSubService.unsubscribe(DIALOG_OPEN_EVENT, open)
  pubSubService.unsubscribe(DIALOG_CLOSE_ALL, closeAll)
})

const open = (dlgInfo: DialogWithComponent | DialogWithText) => {
  const dlg: DialogWindow = {
    ...dlgInfo,
    id: counter++,
    noModal: dlgInfo.noModal,
    size: dlgInfo.size ? dlgInfo.size : 'sm',
    title: dlgInfo.title,
    description: dlgInfo.description,
    resolveFunction: dlgInfo.resolveFunction,
    okTitle: dlgInfo.okTitle || 'Ok',
    cancelTitle: dlgInfo.cancelTitle || 'Cancel',
    okOnly: dlgInfo.okOnly,
    show: true,
    okLoading: false,
    okDisabled: dlgInfo.okDisabled,
    hideFooter: dlgInfo.hideFooter,
    resolved: false,
    width: dlgInfo.width,
    height: dlgInfo.height,
    fullHeight: dlgInfo.fullHeight,
    closable: 'closable' in dlgInfo ? dlgInfo.closable : true,
    isChanged: dlgInfo.isChanged,
    result: dlgInfo.result,
  };
  if ((dlg as DialogWithComponent).component) {
    const dlgComp = dlg as DialogWithComponent
    dlgComp.component = markRaw(dlgComp.component)
  }
  dialogs.push(dlg)
  const checkDialogExist = setInterval(() => {
    const el = document.querySelector(`.${uniqKey(dlg)}`)
    if (el) {
      clearInterval(checkDialogExist)
      dlg.el = el as HTMLElement
      // dialogManager.dialogCreated(modal)
    }
  }, 100)
}

const closeAll = (all: boolean = false): void => {
  dialogs.forEach(dlg => {
    if (all || !dlg.noModal) {
      remove(dlg)
    }
  });
}

const remove = (dlg: DialogWindow) => {
  dlg.resolved = true;
  nextTick(() => {
    const i = dialogs.indexOf(dlg)
    if (i > -1) {
      dialogs.splice(i, 1);
      // dialogManager.dialogClosed(modal);
    }
  });
}

const dlgWidth = (dlg: DialogWindow) => {
  nextTick(() => {
    if (dlg.height) {
      if (!dlg.el) {
        dlg.el = document.querySelector(`.${uniqKey(dlg)}`) as HTMLElement
      }
      if (dlg.el) {
        dlg.el.style.height = String(dlgHeight(dlg))
      }
    }
  });
  return dlg.width ? dlg.width : 'auto'
}

const dlgHeight = (dlg: DialogWindow) => {
  if (dlg.fullHeight) {
    return '100%'
  }
  return dlg.height ? dlg.height : 'auto'
}

const dlgClass = (dlg: DialogWindow): string => {
  let result = dlg.width ? '' : 'modal'
  if (dlg.fullHeight) {
    result += ' height-full'
  }
  result += ` ${uniqKey(dlg)}`
  return result
}

const handleCancel = (dlg: DialogWindow, btn: DialogButton = DialogButton.Cancel) => {
  dlg.show = false
  remove(dlg)
  if (!dlg.resolveFunction) {
    return
  }
  dlg.resolveFunction({ button: btn, result: dlg.result })
}

const handleOk = (dlg: DialogWindow) => {
  dlg.show = false
  remove(dlg)
  if (typeof dlg.resolveFunction === 'function') {
    dlg.resolveFunction({ button: DialogButton.Ok, result: dlg.result })
  }
}

</script>

<style lang="scss" scoped>
.dialog-container {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.5);
}

.dialog {
  margin: auto;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.dialog-content {
  display: flex;
  flex-flow: column nowrap;

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .dialog-body {
    margin-bottom: 16px;
  }

  .dialog-btn {
    margin-right: 8px;
  }

  .dialog-checkbox {
    margin-top: 8px;
    display: flex;
    align-items: center;

    &__input {
      margin-right: 4px;
    }
  }
}
</style>