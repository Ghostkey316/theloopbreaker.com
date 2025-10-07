from vaultfire.ethics import BehavioralEthicsMonitor, ConsentFirstMirror


def test_behavioral_ethics_monitor_and_consent_first_mirror():
    monitor = BehavioralEthicsMonitor(threshold=0.6)
    positive = monitor.evaluate({"ethic": "aligned", "alignment": 0.9, "consent": True})
    assert positive["trusted"]

    negative = monitor.evaluate({"ethic": "betrayal", "alignment": 0.95, "consent": True})
    assert not negative["trusted"]

    mirror = ConsentFirstMirror(monitor)
    verified = mirror.verify("user-1", consent=True, review=positive)
    assert verified["verified"]

    denied = mirror.verify("user-2", consent=False, alignment=0.9, ethic="aligned")
    assert not denied["verified"]

    lock = mirror.lock_report()
    assert lock["verifications"]
    assert not lock["all_verified"]
