import { Alert } from 'react-native';

/**
 * 쉼표뽑기 탭은 하단 탭 전환 시에도 화면이 언마운트되지 않아, 상태(설문 완료 여부·뽑은 카드)가
 * 그대로 남는다. 탭 레이아웃/홈 화면(다른 파일)에서 "진행 중인 뽑기가 있는지" 확인하고 초기화를
 * 트리거할 수 있도록, pindraw 화면이 자신의 상태 getter와 초기화 함수를 여기에 등록해둔다.
 */
let getHasProgress: () => boolean = () => false;
let resetSession: () => void = () => {};

export function registerPindrawSession(hasProgressGetter: () => boolean, reset: () => void) {
  getHasProgress = hasProgressGetter;
  resetSession = reset;
}

export function pindrawHasProgress(): boolean {
  return getHasProgress();
}

export function resetPindrawSession(): void {
  resetSession();
}

/**
 * 진행 중인 뽑기가 없으면 바로 진행하고, 있으면 초기화 여부를 확인창으로 물은 뒤
 * "초기화"를 눌렀을 때만 상태를 리셋하고 진행한다. 탭 이동 가로채기와 홈 화면의
 * "쉼표 뽑기" 버튼 등, 쉼표뽑기 상태를 버리게 되는 모든 진입점에서 공용으로 쓴다.
 */
export function confirmResetIfNeeded(onProceed: () => void, onCancel?: () => void): void {
  if (!pindrawHasProgress()) {
    onProceed();
    return;
  }

  Alert.alert(
    '쉼표 뽑기 초기화',
    '현재 뽑기 내용이 초기화됩니다. 초기화하시겠습니까?',
    [
      { text: '취소', style: 'cancel', onPress: onCancel },
      {
        text: '초기화',
        style: 'destructive',
        onPress: () => {
          resetPindrawSession();
          onProceed();
        },
      },
    ],
  );
}
